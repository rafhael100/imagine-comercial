import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, chmod, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectFaiscaOfflineOperatorAggregate } from '../ops/faisca/openai/private-provider-operator-audit.mjs';

const BLOCKED = 'R168 BLOCKED: private offline evidence rejected.';
const PRIVATE_MARKER = 'R227_FAKE_CREDENTIAL_MUST_NOT_LEAK';
const data = {
  before: {
    schema: 'faisca.private-ledger-readonly-snapshot.v1',
    requests: 0, reservedMicros: 0, limitRequests: 4, limitMicros: 1_000_000,
    atomicAcrossProcesses: false, providerUsageReconciled: false,
    publicReady: false, operationalEffects: false
  },
  after: {
    schema: 'faisca.private-ledger-readonly-snapshot.v1',
    requests: 2, reservedMicros: 40_000, limitRequests: 4, limitMicros: 1_000_000,
    atomicAcrossProcesses: false, providerUsageReconciled: false,
    publicReady: false, operationalEffects: false
  },
  aggregate: {
    schema: 'faisca.private-provider-aggregate-evidence.v1',
    scope: 'isolated_private_review_only',
    totalRequests: 2, lunaRequests: 1, terraRequests: 1,
    actualCostMicros: 20_000, publicReady: false, operationalEffects: false
  }
};
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r227-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pins = {};
  for (const name of ['before', 'after', 'aggregate']) {
    const bytes = JSON.stringify(data[name]) + '\n';
    await writeFile(join(directory, name + '.json'), bytes, { mode: 0o600 });
    pins[name] = createHash('sha256').update(bytes).digest('hex');
  }
  return { directory, pins };
}
async function rejectsSafely(directory, pins) {
  await assert.rejects(
    inspectFaiscaOfflineOperatorAggregate({
      directory, outcome: 'success', expectedSha256: pins
    }),
    error => error.message === BLOCKED &&
      !error.message.includes(PRIVATE_MARKER) &&
      !error.message.includes(directory)
  );
}

test('R227 copied independent SHA pins survive mutation of the operator object after invocation', async t => {
  const { directory, pins } = await fixture(t);
  const pending = inspectFaiscaOfflineOperatorAggregate({
    directory, outcome: 'success', expectedSha256: pins
  });
  pins.before = '0'.repeat(64);
  pins.after = '0'.repeat(64);
  pins.aggregate = '0'.repeat(64);
  const result = await pending;
  assert.equal(result.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(result.localRequests, 2);
  assert.equal(result.providerUsageReconciled, false);
  assert.equal(result.publicReady, false);
});

test('R227 refuses hash getters without ever executing them', async t => {
  const { directory, pins } = await fixture(t);
  let invoked = 0;
  for (const name of ['before', 'after', 'aggregate']) {
    const invalid = { ...pins };
    Object.defineProperty(invalid, name, {
      enumerable: true,
      get() { invoked++; return pins[name]; }
    });
    await rejectsSafely(directory, invalid);
  }
  assert.equal(invoked, 0);
});

test('R227 blocks symbolic, hidden and proxy-origin digest evidence with sanitized errors', async t => {
  const { directory, pins } = await fixture(t);
  const symbol = { ...pins };
  symbol[Symbol('extra-digest')] = PRIVATE_MARKER;
  const hidden = { ...pins };
  Object.defineProperty(hidden, 'other', { value: PRIVATE_MARKER });
  for (const invalid of [
    symbol, hidden,
    new Proxy({ ...pins }, { ownKeys() { throw Error(PRIVATE_MARKER); } }),
    new Proxy({ ...pins }, { getOwnPropertyDescriptor() { throw Error(PRIVATE_MARKER); } }),
    new Proxy({ ...pins }, { getPrototypeOf() { throw Error(PRIVATE_MARKER); } })
  ]) await rejectsSafely(directory, invalid);
});

test('R227 still rejects independently pinned mismatches and accepts a valid immutable fixture', async t => {
  const { directory, pins } = await fixture(t);
  await rejectsSafely(directory, { ...pins, aggregate: 'f'.repeat(64) });
  const result = await inspectFaiscaOfflineOperatorAggregate({
    directory, outcome: 'success', expectedSha256: Object.freeze({ ...pins })
  });
  assert.equal(result.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(result.externalAttestationVerified, false);
  assert.equal(result.operationalEffects, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, chmod, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectFaiscaOfflineOperatorAggregate } from '../ops/faisca/openai/private-provider-operator-audit.mjs';

const BLOCKED = 'R168 BLOCKED: private offline evidence rejected.';
const values = {
  before: {
    schema: 'faisca.private-ledger-readonly-snapshot.v1',
    requests: 0, reservedMicros: 0, limitRequests: 3, limitMicros: 1000000,
    atomicAcrossProcesses: false, providerUsageReconciled: false,
    publicReady: false, operationalEffects: false
  },
  after: {
    schema: 'faisca.private-ledger-readonly-snapshot.v1',
    requests: 2, reservedMicros: 40000, limitRequests: 3, limitMicros: 1000000,
    atomicAcrossProcesses: false, providerUsageReconciled: false,
    publicReady: false, operationalEffects: false
  },
  aggregate: {
    schema: 'faisca.private-provider-aggregate-evidence.v1',
    scope: 'isolated_private_review_only',
    lunaRequests: 1, terraRequests: 1, totalRequests: 2, actualCostMicros: 10000,
    publicReady: false, operationalEffects: false
  }
};
const canonical = value => JSON.stringify(value) + '\n';
const digest = raw => createHash('sha256').update(raw).digest('hex');

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r171-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pins = {};
  for (const name of ['before', 'after', 'aggregate']) {
    const raw = canonical(values[name]);
    await writeFile(join(directory, name + '.json'), raw, { mode: 0o600 });
    pins[name] = digest(raw);
  }
  return { directory, pins };
}

test('R171 independently supplied SHA-256 pins bind all three evidence byte streams, still NO-GO', async t => {
  const { directory, pins } = await fixture(t);
  const result = await inspectFaiscaOfflineOperatorAggregate({
    directory, outcome: 'success', expectedSha256: pins
  });
  assert.equal(result.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(result.localRequests, 2);
  assert.equal(result.localReservedMicros, 40000);
  assert.equal(result.providerUsageReconciled, false);
  assert.equal(result.externalAttestationVerified, false);
  assert.equal(result.publicReady, false);
  assert.equal(JSON.stringify(result).includes(pins.aggregate), false);
  // Existing synthetic CI integration remains backward-compatible.
  const legacy = await inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' });
  assert.equal(legacy.status, result.status);
});

test('R171 refuses each separately pinned digest when substituted, with privacy-safe failure', async t => {
  const { directory, pins } = await fixture(t);
  for (const name of ['before', 'after', 'aggregate']) {
    await assert.rejects(
      inspectFaiscaOfflineOperatorAggregate({
        directory, outcome: 'success',
        expectedSha256: { ...pins, [name]: '0'.repeat(64) }
      }),
      error => error.message === BLOCKED && !error.message.includes(directory)
    );
  }
});

test('R171 modified yet canonical same-count file is rejected by independent pins', async t => {
  const { directory, pins } = await fixture(t);
  await writeFile(join(directory, 'aggregate.json'), canonical({
    ...values.aggregate, actualCostMicros: 10001
  }), { mode: 0o600 });
  await assert.rejects(
    () => inspectFaiscaOfflineOperatorAggregate({
      directory, outcome: 'success', expectedSha256: pins
    }),
    error => error.message === BLOCKED && !error.message.includes(directory)
  );
  // Unpinned legacy audit cannot detect a plausible numeric substitution.
  const legacy = await inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' });
  assert.equal(legacy.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
});

test('R171 rejects loose or untrusted pins, uppercase SHA, extra metadata and malformed objects', async t => {
  const { directory, pins } = await fixture(t);
  for (const expectedSha256 of [
    null, {}, [], { ...pins, note: 'operator email' },
    { ...pins, aggregate: 'ABC' },
    { ...pins, aggregate: pins.aggregate.toUpperCase() },
    { ...pins, after: 0 },
    Object.assign(Object.create(null), pins),
    { ...pins, before: undefined }
  ]) {
    await assert.rejects(
      () => inspectFaiscaOfflineOperatorAggregate({
        directory, outcome: 'success', expectedSha256
      }),
      error => error.message === BLOCKED && !error.message.includes('operator email')
    );
  }
});

test('R171 offline CLI blocks missing independently provisioned pins; no path/secret echoed', () => {
  const marker = 'sensitive-fixture-marker-only';
  const run = spawnSync(process.execPath, [
    'scripts/faisca-private-provider-offline-audit.mjs', '0'.repeat(40), 'success'
  ], {
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      ...process.env, CI: 'true',
      FAISCA_PRIVATE_PROVIDER_AUDIT_ACK: 'YES_OFFLINE_NUMERIC_REVIEW_ONLY',
      FAISCA_PRIVATE_PROVIDER_AUDIT_DIRECTORY: '/private/' + marker,
      FAISCA_PRIVATE_PROVIDER_AUDIT_PINS_JSON: ''
    },
    encoding: 'utf8', timeout: 5000
  });
  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /R167 BLOCKED/u);
  assert.equal(run.stderr.includes(marker), false);
});

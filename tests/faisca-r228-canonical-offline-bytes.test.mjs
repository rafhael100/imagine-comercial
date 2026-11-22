import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectFaiscaOfflineOperatorAggregate } from '../ops/faisca/openai/private-provider-operator-audit.mjs';

const BLOCKED = 'R168 BLOCKED: private offline evidence rejected.';
const samples = {
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
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Buffer.from(JSON.stringify(value) + '\n', 'utf8');

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r228-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pins = {};
  for (const key of ['before', 'after', 'aggregate']) {
    const bytes = canonical(samples[key]);
    await writeFile(join(directory, key + '.json'), bytes, { mode: 0o600 });
    pins[key] = digest(bytes);
  }
  return { directory, pins };
}

async function assertBlocked(directory, pins) {
  await assert.rejects(
    inspectFaiscaOfflineOperatorAggregate({
      directory, outcome: 'success', expectedSha256: pins
    }),
    error => error.message === BLOCKED &&
      !error.message.includes(directory) &&
      !error.message.includes('FAKE_PRIVATE_MARKER')
  );
}

test('R228 valid UTF-8 canonical bytes keep the numeric-only, NO-GO result', async t => {
  const { directory, pins } = await fixture(t);
  const result = await inspectFaiscaOfflineOperatorAggregate({
    directory, outcome: 'success', expectedSha256: pins
  });
  assert.equal(result.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(result.localRequests, 2);
  assert.equal(result.providerUsageReconciled, false);
  assert.equal(result.externalAttestationVerified, false);
  assert.equal(result.operationalEffects, false);
  assert.equal(result.publicReady, false);
});

test('R228 rejects invalid UTF-8 even when independent SHA pins match those exact bytes', async t => {
  const { directory, pins } = await fixture(t);
  const bytes = canonical(samples.aggregate);
  // Replace one UTF-8 byte inside a JSON string with an invalid lead byte.
  const offset = bytes.indexOf(Buffer.from('isolated_private_review_only'));
  assert.ok(offset >= 0);
  bytes[offset + 3] = 0xff;
  pins.aggregate = digest(bytes);
  await writeFile(join(directory, 'aggregate.json'), bytes, { mode: 0o600 });
  await assertBlocked(directory, pins);
});

test('R228 rejects Unicode BOM even with matching SHA pins; no relaxed JSON decoding', async t => {
  const { directory, pins } = await fixture(t);
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), canonical(samples.before)]);
  pins.before = digest(bytes);
  await writeFile(join(directory, 'before.json'), bytes, { mode: 0o600 });
  await assertBlocked(directory, pins);
});

test('R228 refuses noncanonical CRLF bytes with matching SHA and keeps error sanitized', async t => {
  const { directory, pins } = await fixture(t);
  const bytes = Buffer.from(JSON.stringify(samples.after) + '\r\n', 'utf8');
  pins.after = digest(bytes);
  await writeFile(join(directory, 'after.json'), bytes, { mode: 0o600 });
  await assertBlocked(directory, pins);
});

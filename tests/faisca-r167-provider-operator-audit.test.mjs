import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectFaiscaOfflineOperatorAggregate } from '../ops/faisca/openai/private-provider-operator-audit.mjs';

const snapshot = (requests, reservedMicros) => ({
  schema: 'faisca.private-ledger-readonly-snapshot.v1',
  requests, reservedMicros, limitRequests: 3, limitMicros: 1000000,
  atomicAcrossProcesses: false, providerUsageReconciled: false,
  publicReady: false, operationalEffects: false
});
const evidence = (totalRequests, actualCostMicros = 10000) => ({
  schema: 'faisca.private-provider-aggregate-evidence.v1',
  scope: 'isolated_private_review_only',
  lunaRequests: Number(totalRequests >= 1),
  terraRequests: Number(totalRequests === 2),
  totalRequests, actualCostMicros, publicReady: false,
  operationalEffects: false
});
async function fixture(t, {
  before = snapshot(0, 0), after = snapshot(2, 40000),
  aggregate = evidence(2)
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r167-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, value] of [
    ['before.json', before], ['after.json', after], ['aggregate.json', aggregate]
  ]) {
    await writeFile(join(directory, name), JSON.stringify(value) + '\n', { mode: 0o600 });
  }
  return directory;
}

test('R167 offline operator audit compares fixed, private, numeric evidence and never grants GO', async t => {
  const directory = await fixture(t);
  const report = await inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' });
  assert.equal(report.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(report.localRequests, 2);
  assert.equal(report.localReservedMicros, 40000);
  assert.equal(report.providerUsageReconciled, false);
  assert.equal(report.externalAttestationVerified, false);
  assert.equal(report.publicReady, false);
  assert.equal(report.operationalEffects, false);
  assert.deepEqual(Object.keys(report).sort(), [
    'externalAttestationVerified', 'localRequests', 'localReservedMicros',
    'operationalEffects', 'providerUsageReconciled', 'publicReady',
    'schema', 'status'
  ].sort());
});

test('R167 blocks unverified mismatches and overspending without upstream calls', async t => {
  const missing = await fixture(t, { aggregate: evidence(1) });
  const a = await inspectFaiscaOfflineOperatorAggregate({ directory: missing, outcome: 'success' });
  assert.equal(a.status, 'BLOCKED_REQUEST_MISMATCH');
  const expensive = await fixture(t, { aggregate: evidence(2, 40001) });
  const b = await inspectFaiscaOfflineOperatorAggregate({ directory: expensive, outcome: 'success' });
  assert.equal(b.status, 'BLOCKED_COST_EXCEEDS_RESERVATION');
  const rejected = await fixture(t, {
    before: snapshot(0, 0), after: snapshot(0, 0), aggregate: evidence(0, 0)
  });
  const c = await inspectFaiscaOfflineOperatorAggregate({ directory: rejected, outcome: 'rejected' });
  assert.equal(c.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
});

test('R167 fails closed on extra personal fields, duplicate keys, noncanonical JSON and oversized files', async t => {
  const directory = await fixture(t);
  const path = join(directory, 'aggregate.json');
  for (const payload of [
    { ...evidence(2), email: 'hidden-person@example.invalid' },
    '{"totalRequests":0,"totalRequests":2}\n',
    JSON.stringify(evidence(2)),
    'x'.repeat(1100)
  ]) {
    await writeFile(path, typeof payload === 'string' ? payload : JSON.stringify(payload) + '\n');
    // Canonical but forbidden field still produces BLOCKED, never an echo.
    if (typeof payload === 'object') {
      const r = await inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' });
      assert.equal(r.status, 'BLOCKED_INVALID_EVIDENCE');
      assert.equal(JSON.stringify(r).includes('hidden-person'), false);
    } else {
      await assert.rejects(() => inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' }));
    }
  }
});

test('R167 refuses symlinked, group-readable, missing and non-private files/directories', async t => {
  const directory = await fixture(t);
  const path = join(directory, 'aggregate.json');
  await chmod(path, 0o644);
  await assert.rejects(() => inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' }));
  await chmod(path, 0o600);
  const outside = join(directory, 'out.json');
  await writeFile(outside, JSON.stringify(evidence(2)) + '\n', { mode: 0o600 });
  await rm(path);
  await symlink(outside, path);
  await assert.rejects(() => inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' }));
  await rm(path);
  await assert.rejects(() => inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' }));
  await writeFile(path, JSON.stringify(evidence(2)) + '\n', { mode: 0o600 });
  await chmod(directory, 0o755);
  await assert.rejects(() => inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' }));
});

test('R167 private CLI refuses CI and never echoes evidence or secrets', () => {
  const result = spawnSync(process.execPath, [
    'scripts/faisca-private-provider-offline-audit.mjs', '0'.repeat(40), 'success'
  ], {
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      ...process.env, CI: 'true',
      FAISCA_PRIVATE_PROVIDER_AUDIT_ACK: 'YES_OFFLINE_NUMERIC_REVIEW_ONLY',
      FAISCA_PRIVATE_PROVIDER_AUDIT_DIRECTORY: '/not-a-real-private-dir'
    },
    encoding: 'utf8', timeout: 5000
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /R167 BLOCKED/u);
  assert.equal(result.stderr.includes('/not-a-real-private-dir'), false);
});

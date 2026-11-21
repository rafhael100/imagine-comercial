import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectFaiscaOfflineOperatorAggregate } from '../ops/faisca/openai/private-provider-operator-audit.mjs';

const ERROR = 'R168 BLOCKED: private offline evidence rejected.';
const snapshot = (requests, reservedMicros) => ({
  schema: 'faisca.private-ledger-readonly-snapshot.v1',
  requests, reservedMicros, limitRequests: 3, limitMicros: 1000000,
  atomicAcrossProcesses: false, providerUsageReconciled: false,
  publicReady: false, operationalEffects: false
});
const aggregate = {
  schema: 'faisca.private-provider-aggregate-evidence.v1',
  scope: 'isolated_private_review_only',
  lunaRequests: 1, terraRequests: 1, totalRequests: 2,
  actualCostMicros: 12000, publicReady: false, operationalEffects: false
};

async function directoryFor(t) {
  const directory = await mkdtemp(join(tmpdir(), 'r168-private-sensitive-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { force: true, recursive: true }));
  for (const [name, value] of [
    ['before.json', snapshot(0, 0)],
    ['after.json', snapshot(2, 40000)],
    ['aggregate.json', aggregate]
  ]) {
    await writeFile(join(directory, name), JSON.stringify(value) + '\n', { mode: 0o600 });
  }
  return directory;
}

test('R168 stable two-pass private evidence remains review pending, never reconciled', async t => {
  const directory = await directoryFor(t);
  const report = await inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' });
  assert.equal(report.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(report.providerUsageReconciled, false);
  assert.equal(report.publicReady, false);
});

test('R168 sanitizes malformed JSON even if parser would expose a private content fragment', async t => {
  const directory = await directoryFor(t);
  const secret = 'private-name@example.invalid and sk-test-synthetic-private-marker';
  await writeFile(join(directory, 'aggregate.json'), '{' + secret + ':');
  await assert.rejects(() =>
    inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' }),
    error => error.message === ERROR &&
      !error.message.includes(secret) && !error.message.includes(directory));
});

test('R168 does not echo local filenames and paths on missing evidence or bad configuration', async t => {
  const directory = await directoryFor(t);
  await rm(join(directory, 'after.json'));
  await assert.rejects(() =>
    inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' }),
    error => error.message === ERROR && !error.message.includes(directory));
  await assert.rejects(() =>
    inspectFaiscaOfflineOperatorAggregate({ directory: '/not-a-real-ledger/private', outcome: 'success' }),
    error => error.message === ERROR && !error.message.includes('not-a-real-ledger'));
  await assert.rejects(() =>
    inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'unknown' }),
    error => error.message === ERROR);
});

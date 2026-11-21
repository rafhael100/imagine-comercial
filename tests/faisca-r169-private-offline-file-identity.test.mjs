import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, link, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
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

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r169-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, value] of [
    ['before.json', snapshot(0, 0)],
    ['after.json', snapshot(2, 40000)],
    ['aggregate.json', aggregate]
  ]) {
    await writeFile(join(directory, name), JSON.stringify(value) + '\n', { mode: 0o600 });
  }
  return directory;
}

test('R169 unchanged canonical private evidence remains non-operational, review pending', async t => {
  const directory = await fixture(t);
  const report = await inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' });
  assert.equal(report.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(report.providerUsageReconciled, false);
  assert.equal(report.externalAttestationVerified, false);
  assert.equal(report.publicReady, false);
  assert.equal(report.operationalEffects, false);
});

test('R169 rejects hardlinked evidence even when JSON and permissions are valid', async t => {
  const directory = await fixture(t);
  const extraName = join(directory, 'same-inode-private-copy');
  await link(join(directory, 'aggregate.json'), extraName);
  await assert.rejects(
    () => inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' }),
    err => err.message === ERROR && !err.message.includes(directory)
  );
  await rm(extraName);
  const report = await inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' });
  assert.equal(report.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
});

test('R169 refuses oversized evidence without printing file contents or paths', async t => {
  const directory = await fixture(t);
  await writeFile(join(directory, 'aggregate.json'), Buffer.alloc(3 * 1024 * 1024, 'x'));
  await assert.rejects(
    () => inspectFaiscaOfflineOperatorAggregate({ directory, outcome: 'success' }),
    err => err.message === ERROR && !err.message.includes(directory)
  );
});

test('R169 rejects a FIFO instead of blocking on open, even with no writer', { timeout: 6000 }, async t => {
  if (process.platform !== 'linux') {
    t.skip('POSIX FIFO fixture requires Linux');
    return;
  }
  const directory = await fixture(t);
  await rm(join(directory, 'aggregate.json'));
  const mkfifo = spawnSync('mkfifo', [join(directory, 'aggregate.json')], {
    encoding: 'utf8', timeout: 1500
  });
  assert.equal(mkfifo.status, 0);
  const moduleUrl = new URL('../ops/faisca/openai/private-provider-operator-audit.mjs', import.meta.url).href;
  const script = `import { inspectFaiscaOfflineOperatorAggregate } from ${JSON.stringify(moduleUrl)};
try {
  await inspectFaiscaOfflineOperatorAggregate({ directory: process.argv[1], outcome: 'success' });
  process.exitCode = 9;
} catch (error) {
  process.exitCode = error.message === 'R168 BLOCKED: private offline evidence rejected.' ? 0 : 8;
}`;
  const run = spawnSync(process.execPath, ['--input-type=module', '--eval', script, directory], {
    encoding: 'utf8', timeout: 3000
  });
  assert.equal(run.error, undefined);
  assert.equal(run.status, 0);
  assert.equal(run.stdout, '');
});

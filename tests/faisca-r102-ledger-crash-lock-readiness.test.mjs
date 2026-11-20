import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, writeFile, readFile, unlink, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { inspectFaiscaPrivateStaging } from '../ops/faisca/openai/private-staging-preflight.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r102-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    directory, state: join(directory, 'faisca-reservations.json'),
    lock: join(directory, '.faisca-reservations.lock'),
    ledger: () => createFaiscaLocalReservationLedger({
      directory, maxRequests: 100, maxBudgetUsd: 10
    })
  };
}
const sha = 'a'.repeat(40);
async function staging(directory) {
  return inspectFaiscaPrivateStaging({
    expectedHead: sha, nodeVersion: '22.12.0',
    gitRevision: async () => sha, isClean: async () => true,
    checkPort: async () => undefined,
    env: {
      OPENAI_API_KEY: 'sk-SYNTHETIC_R102_NO_REAL_KEY_123456',
      FAISCA_REVIEW_BEARER_TOKEN: 'R102_SYNTHETIC_PRIVATE_OPERATOR_TOKEN_123456',
      FAISCA_PRIVATE_LEDGER_DIR: directory,
      IMAGINE_FAISCA_OPENAI_LIVE_TEST: 'YES_PAY_SYNTHETIC_ONLY'
    }
  });
}

test('R102 a crash-remnant lock blocks direct ready() even when state and capacity are valid', async t => {
  const f = await fixture(t);
  await f.ledger().reserve(0.1);
  const state = await readFile(f.state);
  await writeFile(f.lock, 'synthetic crash lock\n', { mode: 0o600 });

  await assert.rejects(f.ledger().ready(), /reservation locked/);
  await assert.rejects(f.ledger().ready({
    requireCapacity: true, minimumRequests: 2, minimumBudgetUsd: 0.01
  }), /reservation locked/);
  await assert.rejects(f.ledger().reserve(0.02), /busy or unavailable/);
  assert.deepEqual(await readFile(f.state), state, 'NO-START must not alter spent quota');
  assert.equal(await readFile(f.lock, 'utf8'), 'synthetic crash lock\n',
    'Do not auto-recover a crash lock');

  const preflight = await staging(f.directory);
  assert.equal(preflight.status, 'BLOCKED_NO_START');
  assert.ok(preflight.failedChecks.includes('private_persistent_ledger_ready_without_lock'));
  assert.equal(preflight.realApiCalled, false);
  assert.equal(preflight.publicFaiscaEnabled, false);

  await unlink(f.lock); // Deliberate fixture cleanup, never by production code.
  assert.equal(await f.ledger().ready({ requireCapacity: true, minimumRequests: 2 }), true);
  assert.equal((await f.ledger().reserve(0.02)).requests, 2);
});

test('R102 symlinked lock is not followed or removed by a direct readiness check', async t => {
  const f = await fixture(t);
  const target = join(f.directory, 'unrelated-synthetic-file');
  await writeFile(target, 'keep this test file\n', { mode: 0o600 });
  await symlink(target, f.lock);
  await assert.rejects(f.ledger().ready(), /reservation locked/);
  assert.equal(await readFile(target, 'utf8'), 'keep this test file\n');
  assert.equal((await staging(f.directory)).status, 'BLOCKED_NO_START');
});

test('R102 a brand-new unlocked empty ledger stays read-only at readiness', async t => {
  const f = await fixture(t);
  assert.equal(await f.ledger().ready(), true);
  await assert.rejects(readFile(f.state), { code: 'ENOENT' });
  await assert.rejects(readFile(f.lock), { code: 'ENOENT' });
});

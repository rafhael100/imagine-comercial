import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectFaiscaPrivateStaging } from '../ops/faisca/openai/private-staging-preflight.mjs';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

const pin = 'a'.repeat(40);
const stateFile = 'faisca-reservations.json';
const baseState = Object.freeze({
  schema: 'faisca.private-local-reservations.v1',
  requests: 1, reservedMicros: 10000,
  limitRequests: 100, limitMicros: 10000000
});
const failCode = 'private_persistent_ledger_ready_without_lock';
async function directory(t) {
  const dir = await mkdtemp(join(tmpdir(), 'faisca-r89-'));
  await chmod(dir, 0o700);
  t.after(() => rm(dir, { force: true, recursive: true }));
  return dir;
}
async function inspect(dir) {
  return inspectFaiscaPrivateStaging({
    expectedHead: pin,
    env: {
      OPENAI_API_KEY: 'sk-SYNTHETIC_R89_NOT_A_SECRET_123',
      FAISCA_REVIEW_BEARER_TOKEN: 'R89_SYNTHETIC_OPERATOR_TOKEN_123456789',
      FAISCA_PRIVATE_LEDGER_DIR: dir,
      IMAGINE_FAISCA_OPENAI_LIVE_TEST: 'YES_PAY_SYNTHETIC_ONLY'
    },
    nodeVersion: '22.12.0',
    gitRevision: async () => pin,
    isClean: async () => true,
    checkPort: async () => undefined
  });
}
async function store(dir, value, mode = 0o600) {
  await writeFile(join(dir, stateFile), JSON.stringify(value) + '\n', { mode });
}
function blocked(value) {
  assert.equal(value.status, 'BLOCKED_NO_START');
  assert.ok(value.failedChecks.includes(failCode));
  assert.equal(value.realApiCalled, false);
  assert.equal(value.productionApproved, false);
  assert.equal(value.publicFaiscaEnabled, false);
}

test('R89 fresh empty ledger stays unmodified by read-only staging preflight', async t => {
  const dir = await directory(t);
  const result = await inspect(dir);
  assert.equal(result.status, 'READY_FOR_PRIVATE_OPERATOR_START');
  await assert.rejects(readFile(join(dir, stateFile), 'utf8'), { code: 'ENOENT' });
  assert.equal(result.realApiCalled, false);
});

test('R89 persisted intact ledger passes and malformed, policy-mismatched ledgers block before paid launch', async t => {
  const dir = await directory(t);
  const ledger = createFaiscaLocalReservationLedger({
    directory: dir, maxRequests: 100, maxBudgetUsd: 10
  });
  await ledger.reserve(0.01);
  assert.equal((await inspect(dir)).status, 'READY_FOR_PRIVATE_OPERATOR_START');
  await store(dir, { ...baseState, limitRequests: 99 });
  blocked(await inspect(dir));
  await store(dir, { oops: true });
  blocked(await inspect(dir));
  // A bad state must not be erased, reset or reinitialized by the preflight.
  assert.deepEqual(JSON.parse(await readFile(join(dir, stateFile), 'utf8')), { oops: true });
});

test('R89 an exhausted persisted request or budget allocation is not READY_FOR_PRIVATE_OPERATOR_START', async t => {
  const dir = await directory(t);
  await store(dir, { ...baseState, requests: 100 });
  blocked(await inspect(dir));
  await store(dir, { ...baseState, reservedMicros: 10000000 });
  blocked(await inspect(dir));
  await store(dir, baseState);
  assert.equal((await inspect(dir)).status, 'READY_FOR_PRIVATE_OPERATOR_START');
});

test('R89 insecure or symlinked persisted state blocks preflight and never reveals paths', async t => {
  const dir = await directory(t);
  await store(dir, baseState, 0o644);
  let response = await inspect(dir);
  blocked(response);
  assert.doesNotMatch(JSON.stringify(response), /SYNTHETIC_R89|R89_SYNTHETIC_OPERATOR_TOKEN/);
  assert.equal(JSON.stringify(response).includes(dir), false);
  await rm(join(dir, stateFile));
  await symlink(join(dir, 'not-a-ledger'), join(dir, stateFile));
  response = await inspect(dir);
  blocked(response);
});

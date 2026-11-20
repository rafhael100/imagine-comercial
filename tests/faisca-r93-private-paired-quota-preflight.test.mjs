import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectFaiscaPrivateStaging } from '../ops/faisca/openai/private-staging-preflight.mjs';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

const pin = 'a'.repeat(40);
const file = 'faisca-reservations.json';
const baseline = {
  schema: 'faisca.private-local-reservations.v1',
  requests: 0, reservedMicros: 0,
  limitRequests: 100, limitMicros: 10000000
};
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'faisca-r93-'));
  await chmod(dir, 0o700);
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
async function preflight(directory) {
  return inspectFaiscaPrivateStaging({
    expectedHead: pin,
    env: {
      OPENAI_API_KEY: 'sk-R93_SYNTHETIC_NOT_USABLE_123',
      FAISCA_REVIEW_BEARER_TOKEN: 'R93_SYNTHETIC_REVIEW_TOKEN_123456789',
      FAISCA_PRIVATE_LEDGER_DIR: directory,
      IMAGINE_FAISCA_OPENAI_LIVE_TEST: 'YES_PAY_SYNTHETIC_ONLY'
    },
    nodeVersion: '22.12.0',
    gitRevision: async () => pin,
    isClean: async () => true,
    checkPort: async () => undefined
  });
}
async function setState(directory, changes) {
  const data = { ...baseline, ...changes };
  await writeFile(join(directory, file), JSON.stringify(data) + '\n', { mode: 0o600 });
  return JSON.stringify(data) + '\n';
}
function rejected(result) {
  assert.equal(result.status, 'BLOCKED_NO_START');
  assert.ok(result.failedChecks.includes('private_persistent_ledger_ready_without_lock'));
  assert.equal(result.realApiCalled, false);
  assert.equal(result.publicFaiscaEnabled, false);
  assert.equal(result.productionApproved, false);
}

test('R93 staging denies a ledger with one remaining paid call before Luna dispatch', async t => {
  const directory = await fixture(t);
  const before = await setState(directory, { requests: 99, reservedMicros: 1000 });
  rejected(await preflight(directory));
  assert.equal(await readFile(join(directory, file), 'utf8'), before);
});

test('R93 staging denies insufficient paired budget even with two request slots', async t => {
  const directory = await fixture(t);
  const before = await setState(directory, { requests: 98, reservedMicros: 9990001 });
  rejected(await preflight(directory));
  assert.equal(await readFile(join(directory, file), 'utf8'), before);
});

test('R93 staging allows exactly two slots and the conservative minimum budget', async t => {
  const directory = await fixture(t);
  const before = await setState(directory, { requests: 98, reservedMicros: 9990000 });
  const result = await preflight(directory);
  assert.equal(result.status, 'READY_FOR_PRIVATE_OPERATOR_START');
  assert.equal(result.realApiCalled, false);
  assert.equal(await readFile(join(directory, file), 'utf8'), before);
});

test('R93 fresh ledger readiness is strictly read-only and invokes no model', async t => {
  const directory = await fixture(t);
  assert.equal((await preflight(directory)).status, 'READY_FOR_PRIVATE_OPERATOR_START');
  await assert.rejects(readFile(join(directory, file)), { code: 'ENOENT' });
});

test('R93 ledger readiness floor rejects impossible or invalid minimums; reserve enforces capacity', async t => {
  const directory = await fixture(t);
  const ledger = createFaiscaLocalReservationLedger({
    directory, maxRequests: 3, maxBudgetUsd: 0.5
  });
  await assert.rejects(ledger.ready({ requireCapacity: true, minimumRequests: 4 }),
    /Invalid private reservation readiness floor/);
  await assert.rejects(ledger.ready({ requireCapacity: true, minimumBudgetUsd: NaN }),
    /Invalid private reservation readiness floor/);
  await assert.rejects(ledger.ready({ requireCapacity: true, minimumBudgetUsd: -0.01 }),
    /Invalid private reservation readiness floor/);
  assert.equal(await ledger.ready({ requireCapacity: true, minimumRequests: 2,
    minimumBudgetUsd: 0.01 }), true);
  await ledger.reserve(0.49);
  await assert.rejects(ledger.ready({ requireCapacity: true, minimumRequests: 2,
    minimumBudgetUsd: 0.02 }), /limit reached/);
  await ledger.reserve(0.01);
  await assert.rejects(ledger.ready({ requireCapacity: true, minimumRequests: 2,
    minimumBudgetUsd: 0.001 }), /limit reached/);
  assert.equal((await readFile(join(directory, file), 'utf8')).includes('"requests":2'), true);
});

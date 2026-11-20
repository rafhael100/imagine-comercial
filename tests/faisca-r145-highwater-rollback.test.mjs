import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, writeFile, stat, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

const SCHEMA = 'faisca.private-local-reservations.v1';
const HIGHWATER_SCHEMA = 'faisca.private-local-reservations.highwater.v1';
const MARKER_DATA = 'faisca.private-local-reservations.initialized.v1\n';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r145-highwater-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    directory,
    statePath: join(directory, 'faisca-reservations.json'),
    witnessPath: join(directory, '.faisca-reservations-highwater.json'),
    witnessMarkerPath: join(directory, '.faisca-reservations-highwater-initialized'),
    lockPath: join(directory, '.faisca-reservations.lock'),
    ledger: () => createFaiscaLocalReservationLedger({
      directory, maxRequests: 5, maxBudgetUsd: 1
    })
  };
}
const snapshot = (requests, reservedMicros) => ({
  schema: SCHEMA, requests, reservedMicros,
  limitRequests: 5, limitMicros: 1_000_000
});
const encode = value => JSON.stringify(value) + '\n';
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

test('R145 two sequential reservations persist a matching independently fsynced high-water witness', async t => {
  const f = await fixture(t);
  assert.equal((await f.ledger().reserve(0.1)).requests, 1);
  const first = await readJson(f.witnessPath);
  assert.equal(first.requests, 1);
  assert.equal(first.reservedMicros, 100_000);
  assert.equal(first.schema, HIGHWATER_SCHEMA);
  assert.equal(await readFile(f.witnessMarkerPath, 'utf8'), HIGHWATER_SCHEMA + '\n');
  assert.equal((await stat(f.witnessPath)).mode & 0o077, 0);
  assert.equal((await f.ledger().reserve(0.25)).requests, 2);
  const state = await readJson(f.statePath);
  const witness = await readJson(f.witnessPath);
  assert.deepEqual(witness, { ...state, schema: HIGHWATER_SCHEMA });
  assert.equal(state.reservedMicros, 350_000);
  assert.equal(await f.ledger().ready({ requireCapacity: true, minimumRequests: 2, minimumBudgetUsd: 0.5 }), true);
  assert.equal(await f.ledger().ready(), true);
});

test('R145 canonical JSON state rollback is rejected against independent high-water mark', async t => {
  const f = await fixture(t);
  await f.ledger().reserve(0.2);
  const firstState = await readFile(f.statePath, 'utf8');
  await f.ledger().reserve(0.3);
  assert.equal((await readJson(f.statePath)).requests, 2);
  // The attacker/restore tool replaces only the mutable state with a previously
  // perfectly canonical snapshot, not a duplicate-key or malformed JSON file.
  await writeFile(f.statePath, firstState);
  await assert.rejects(f.ledger().ready(), /high-water mismatch/);
  await assert.rejects(f.ledger().reserve(0.01), /high-water mismatch/);
  assert.equal((await stat(f.lockPath)).isFile(), true,
    'ambiguous rollback keeps the durable crash fence until operator review');
  await assert.rejects(f.ledger().reserve(0.01), /busy or unavailable/);
});

test('R145 high-water rollback, deletion and malformed marker fail closed', async t => {
  const f = await fixture(t);
  await f.ledger().reserve(0.15);
  const oldWitness = await readFile(f.witnessPath, 'utf8');
  await f.ledger().reserve(0.1);
  await writeFile(f.witnessPath, oldWitness);
  await assert.rejects(f.ledger().ready(), /high-water mismatch/);
  await writeFile(f.witnessPath, encode({ ...(await readJson(f.statePath)), schema: HIGHWATER_SCHEMA }));
  assert.equal(await f.ledger().ready(), true);
  await unlink(f.witnessPath);
  await assert.rejects(f.ledger().ready(), /high-water witness missing/);
  // Restoring the witness is not enough to recover a malformed marker.
  await writeFile(f.witnessPath, encode({ ...(await readJson(f.statePath)), schema: HIGHWATER_SCHEMA }), { mode: 0o600 });
  await writeFile(f.witnessMarkerPath, 'broken marker\n');
  await assert.rejects(f.ledger().ready(), /high-water marker requires operator review/);
});

test('R145 existing R82/R143 state without a high-water file migrates without quota reset', async t => {
  const f = await fixture(t);
  await writeFile(join(f.directory, '.faisca-reservations-initialized'), MARKER_DATA, { mode: 0o600 });
  await writeFile(f.statePath, encode(snapshot(2, 380_000)), { mode: 0o600 });
  assert.equal(await f.ledger().ready(), true, 'legacy valid state is readable');
  assert.equal((await f.ledger().reserve(0.12)).requests, 3);
  assert.deepEqual(await readJson(f.statePath), snapshot(3, 500_000));
  assert.deepEqual(await readJson(f.witnessPath), { ...snapshot(3, 500_000), schema: HIGHWATER_SCHEMA });
  assert.equal(await f.ledger().ready(), true);
});

test('R145 high-water witness cannot silently be removed while marker remains', async t => {
  const f = await fixture(t);
  await f.ledger().reserve(0.15);
  await unlink(f.witnessPath);
  await assert.rejects(f.ledger().ready(), /high-water witness missing/);
  await assert.rejects(f.ledger().reserve(0.01), /high-water witness missing/);
  assert.equal((await stat(f.lockPath)).isFile(), true);
});

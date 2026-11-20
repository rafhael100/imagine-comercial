import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r143-lock-fence-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    directory,
    lock: join(directory, '.faisca-reservations.lock'),
    state: join(directory, 'faisca-reservations.json'),
    ledger: () => createFaiscaLocalReservationLedger({
      directory, maxRequests: 3, maxBudgetUsd: 1
    })
  };
}

test('R143 successful durable reservation releases its lock and preserves the balance across instances', async t => {
  const f = await fixture(t);
  assert.equal((await f.ledger().reserve(0.2)).requests, 1);
  await assert.rejects(readFile(f.lock), { code: 'ENOENT' });
  assert.equal((await f.ledger().reserve(0.3)).requests, 2);
  await assert.rejects(readFile(f.lock), { code: 'ENOENT' });
  const state = JSON.parse(await readFile(f.state, 'utf8'));
  assert.equal(state.requests, 2);
  assert.equal(state.reservedMicros, 500000);
  assert.equal(await f.ledger().ready({
    requireCapacity: true, minimumRequests: 1, minimumBudgetUsd: 0.01
  }), true);
});

test('R143 ordinary quota denial is not an ambiguous write and does not strand the lock', async t => {
  const f = await fixture(t);
  await f.ledger().reserve(0.8);
  await assert.rejects(f.ledger().reserve(0.21), /limit reached/);
  await assert.rejects(readFile(f.lock), { code: 'ENOENT' });
  assert.equal((await f.ledger().reserve(0.1)).requests, 2);
  assert.equal((JSON.parse(await readFile(f.state, 'utf8'))).reservedMicros, 900000);
});

test('R143 malformed spent state leaves durable lock as an operator-review fence', async t => {
  const f = await fixture(t);
  await f.ledger().reserve(0.3);
  const valid = await readFile(f.state, 'utf8');
  await writeFile(f.state, valid.replace('"requests":1', '"requests":1,"requests":0'));
  await assert.rejects(f.ledger().reserve(0.01), /operator review/);
  assert.equal((await stat(f.lock)).mode & 0o077, 0);
  assert.equal((await stat(f.lock)).isFile(), true);
  await assert.rejects(f.ledger().reserve(0.01), /busy or unavailable/);
  // Repairing JSON alone never authorizes auto-recovery from ambiguous state:
  // a human must reconcile the lock and budget, out of band.
  await writeFile(f.state, valid);
  await assert.rejects(f.ledger().ready(), /reservation locked/);
  assert.equal((JSON.parse(await readFile(f.state, 'utf8'))).reservedMicros, 300000);
});

test('R143 invalid initialization marker cannot silently consume or reset quota', async t => {
  const f = await fixture(t);
  const marker = join(f.directory, '.faisca-reservations-initialized');
  await writeFile(marker, 'partial crash marker\n', { mode: 0o600 });
  await assert.rejects(f.ledger().reserve(0.01), /operator review/);
  await assert.rejects(f.ledger().ready(), /operator review/);
  assert.equal((await stat(f.lock)).isFile(), true);
  await assert.rejects(readFile(f.state), { code: 'ENOENT' });
});

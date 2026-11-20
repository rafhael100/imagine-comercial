import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, writeFile, unlink, symlink, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

const markerName = '.faisca-reservations-initialized';
const stateName = 'faisca-reservations.json';
const markerContent = 'faisca.private-local-reservations.initialized.v1\n';
const policy = { maxRequests: 3, maxBudgetUsd: 1 };

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r100-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    directory, state: join(directory, stateName), marker: join(directory, markerName),
    create: () => createFaiscaLocalReservationLedger({ directory, ...policy })
  };
}

test('R100 fresh start stays read-only; first reserved request persists an independent initialization marker', async t => {
  const f = await fixture(t);
  const ledger = f.create();
  assert.equal(await ledger.ready(), true);
  await assert.rejects(readFile(f.marker, 'utf8'), { code: 'ENOENT' });
  assert.equal((await ledger.reserve(0.2)).requests, 1);
  assert.equal(await readFile(f.marker, 'utf8'), markerContent);
  assert.equal((await stat(f.marker)).mode & 0o077, 0);
  assert.equal((JSON.parse(await readFile(f.state, 'utf8'))).reservedMicros, 200000);
});

test('R100 deleted spent ledger must fail closed on readiness and restart; quota cannot reset', async t => {
  const f = await fixture(t);
  const original = f.create();
  await original.reserve(0.6);
  await unlink(f.state);
  const restarted = f.create();
  await assert.rejects(restarted.ready({ requireCapacity: true }), /state missing/);
  await assert.rejects(restarted.reserve(0.01), /state missing/);
  await assert.rejects(readFile(f.state, 'utf8'), { code: 'ENOENT' });
  assert.equal(await readFile(f.marker, 'utf8'), markerContent);
});

test('R100 imports intact R82 legacy state without changing used quota, then enables missing-state detection', async t => {
  const f = await fixture(t);
  const legacy = {
    schema: 'faisca.private-local-reservations.v1',
    requests: 1, reservedMicros: 200000,
    limitRequests: policy.maxRequests, limitMicros: 1000000
  };
  await writeFile(f.state, JSON.stringify(legacy) + '\n', { mode: 0o600 });
  assert.equal(await f.create().ready(), true);
  assert.equal((await f.create().reserve(0.3)).requests, 2);
  assert.equal((JSON.parse(await readFile(f.state, 'utf8'))).reservedMicros, 500000);
  assert.equal(await readFile(f.marker, 'utf8'), markerContent);
  await unlink(f.state);
  await assert.rejects(f.create().reserve(0.01), /state missing/);
});

test('R100 tampered or crash-partial marker is a hard stop, not a fresh allowance', async t => {
  const f = await fixture(t);
  await writeFile(f.marker, 'crash-before-marker-sync', { mode: 0o600 });
  await assert.rejects(f.create().ready(), /marker requires operator review/);
  await assert.rejects(f.create().reserve(0.1), /marker requires operator review/);
  await writeFile(f.marker, markerContent, { mode: 0o600 });
  await assert.rejects(f.create().ready(), /state missing/);
  await chmod(f.marker, 0o644);
  await assert.rejects(f.create().ready(), /marker requires operator review/);
  await unlink(f.marker);
  await symlink(f.state, f.marker);
  await assert.rejects(f.create().ready());
});

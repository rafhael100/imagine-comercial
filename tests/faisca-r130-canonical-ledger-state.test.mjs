import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

const SCHEMA = 'faisca.private-local-reservations.v1';
const STATE = 'faisca-reservations.json';

async function syntheticLedger(t) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r130-ledger-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ledger = createFaiscaLocalReservationLedger({
    directory, maxRequests: 3, maxBudgetUsd: 1
  });
  return { directory, ledger, file: join(directory, STATE) };
}

test('R130 genuine R82 ledger serialization remains valid and migrates conservatively', async t => {
  const { ledger, file } = await syntheticLedger(t);
  await writeFile(file, JSON.stringify({
    schema: SCHEMA, requests: 1, reservedMicros: 10000,
    limitRequests: 3, limitMicros: 1000000
  }) + '\n', { mode: 0o600 });
  assert.equal(await ledger.ready({ requireCapacity: true }), true);
  const reservation = await ledger.reserve(0.01);
  assert.equal(reservation.requests, 2);
  const raw = await readFile(file, 'utf8');
  assert.equal(raw, JSON.stringify(JSON.parse(raw)) + '\n');
});

for (const [label, corrupt] of [
  ['duplicate request count', raw =>
    raw.replace('"requests":1', '"requests":1,"requests":0')],
  ['duplicate reserved budget', raw =>
    raw.replace('"reservedMicros":10000', '"reservedMicros":10000,"reservedMicros":0')],
  ['pretty-printed external rewrite', raw => JSON.stringify(JSON.parse(raw), null, 2) + '\n'],
  ['missing required final newline', raw => raw.trimEnd()]
]) {
  test('R130 rejects noncanonical spend-state encoding: ' + label, async t => {
    const { ledger, file } = await syntheticLedger(t);
    await ledger.reserve(0.01);
    const original = await readFile(file, 'utf8');
    const tampered = corrupt(original);
    assert.notEqual(tampered, original, 'The test must actually mutate the file');
    await writeFile(file, tampered);
    await assert.rejects(ledger.ready({ requireCapacity: true }), /operator review/);
    await assert.rejects(ledger.reserve(0.01), /operator review/);
    assert.equal(await readFile(file, 'utf8'), tampered,
      'Failed preflight and reservation must not reset the mutated state');
  });
}

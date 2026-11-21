import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, link, lstat, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab } from '../ops/faisca/openai/live-lab.mjs';

const persistentFiles = Object.freeze([
  'faisca-reservations.json',
  '.faisca-reservations-initialized',
  '.faisca-reservations-highwater.json',
  '.faisca-reservations-highwater-initialized'
]);

for (const filename of persistentFiles) {
  test('R186 rejects a hardlinked private ledger file: ' + filename, async () => {
    const root = await mkdtemp(join(tmpdir(), 'faisca-r186-'));
    const directory = join(root, 'ledger');
    await mkdir(directory, { mode: 0o700 });
    try {
      const ledger = createFaiscaLocalReservationLedger({
        directory, maxRequests: 2, maxBudgetUsd: 1
      });
      assert.equal((await ledger.reserve(0.01)).requests, 1);
      // A second filesystem name outside the 0700 ledger directory can
      // mutate even an otherwise ordinary 0600 inode. Do not follow it.
      const alias = join(root, 'outside-ledger-alias');
      await link(join(directory, filename), alias);
      assert.equal((await lstat(join(directory, filename))).nlink, 2);
      await assert.rejects(ledger.ready(), /operator review|unsafe permissions or shape/);

      // An injected model transport must remain unused, even when the caller
      // attempts a paid Luna/Terra flow after the compromised-inode check.
      let dispatched = 0;
      const lab = createFaiscaOpenAILiveLab({
        enabled: true, apiKey: 'sk-synthetic-r186-not-a-real-key-123456789',
        extendedPrivateSession: true, maxRequests: 2, maxBudgetUsd: 1,
        reservationLedger: ledger,
        fetchImpl: async () => { dispatched++; throw new Error('Unexpected provider call'); }
      });
      await assert.rejects(lab.answer('compare'), /operator review|unsafe permissions or shape/);
      assert.equal(dispatched, 0, 'No private API egress after a hardlinked state or witness');
      const state = JSON.parse(await readFile(join(directory, 'faisca-reservations.json'), 'utf8'));
      assert.equal(state.requests, 1, 'Existing reservations must not be reset');
      await lstat(join(directory, '.faisca-reservations.lock'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test('R186 normal single-link durable ledger retains cross-process readiness', async () => {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r186-control-'));
  const directory = join(root, 'ledger');
  await mkdir(directory, { mode: 0o700 });
  try {
    const a = createFaiscaLocalReservationLedger({ directory, maxRequests: 2, maxBudgetUsd: 1 });
    const b = createFaiscaLocalReservationLedger({ directory, maxRequests: 2, maxBudgetUsd: 1 });
    assert.equal(await a.ready(), true);
    assert.equal((await a.reserve(0.01)).requests, 1);
    assert.equal(await b.ready(), true);
    assert.equal((await b.reserve(0.01)).requests, 2);
    await assert.rejects(b.reserve(0.01), /limit reached/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

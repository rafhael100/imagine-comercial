import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, writeFile, stat, unlink, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

const run = promisify(execFile);
const syntheticToken = 'R160_FAKE_OPERATOR_TOKEN_NO_REAL_DATA';
const syntheticQuestion = 'Qual e a funcao de uma landing page para um evento ficticio?';
const syntheticAnswer = 'Um resumo sobre uma landing page para um evento totalmente ficticio.';

async function inPrivateDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'faisca-r160-'));
  await chmod(dir, 0o700);
  try { await fn(dir); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

function safeSnapshot(snapshot, count) {
  assert.equal(snapshot.schema, 'faisca.private-ledger-readonly-snapshot.v1');
  assert.equal(snapshot.requests, count);
  assert.equal(snapshot.limitRequests, 3);
  assert.equal(snapshot.limitMicros, 1000000);
  assert.equal(snapshot.atomicAcrossProcesses, false);
  assert.equal(snapshot.providerUsageReconciled, false);
  assert.equal(snapshot.publicReady, false);
  assert.equal(snapshot.operationalEffects, false);
  const json = JSON.stringify(snapshot);
  for (const value of [syntheticToken, syntheticQuestion, syntheticAnswer, 'sk-']) {
    assert.equal(json.includes(value), false);
  }
}

test('R160 read-only snapshot returns zero without creating ledger and counts two durable reservations', async () => {
  await inPrivateDir(async dir => {
    const ledger = createFaiscaLocalReservationLedger({
      directory: dir, maxRequests: 3, maxBudgetUsd: 1
    });
    const empty = await ledger.inspectReadOnly();
    safeSnapshot(empty, 0);
    assert.equal(empty.reservedMicros, 0);
    assert.deepEqual(await readdir(dir), [], 'audit must not create a file or lock');
    await ledger.reserve(0.02);
    await ledger.reserve(0.03);
    const result = await ledger.inspectReadOnly();
    safeSnapshot(result, 2);
    assert.equal(result.reservedMicros, 50000);
    const files = await readdir(dir);
    assert.ok(files.includes('faisca-reservations.json'));
    assert.ok(files.includes('.faisca-reservations-highwater.json'));
    assert.ok(!files.includes('.faisca-reservations.lock'));
    const before = await Promise.all(files.map(async name => [name, await readFile(join(dir, name), 'utf8')]));
    for (const [name, raw] of before) {
      assert.equal((await stat(join(dir, name))).mode & 0o777, 0o600, name);
      for (const secret of [syntheticToken, syntheticQuestion, syntheticAnswer, 'sk-']) {
        assert.equal(raw.includes(secret), false);
      }
    }
    await ledger.inspectReadOnly();
    const after = await Promise.all(files.map(async name => [name, await readFile(join(dir, name), 'utf8')]));
    assert.deepEqual(after, before, 'inspection must not mutate any ledger bytes');
  });
});

test('R160 read-only audit refuses a stale highwater, removed state or a stranded lock', async () => {
  for (const scenario of ['rollback', 'missing-state', 'lock']) {
    await inPrivateDir(async dir => {
      const ledger = createFaiscaLocalReservationLedger({
        directory: dir, maxRequests: 3, maxBudgetUsd: 1
      });
      await ledger.reserve(0.01);
      if (scenario === 'rollback') {
        const p = join(dir, '.faisca-reservations-highwater.json');
        const witness = JSON.parse(await readFile(p, 'utf8'));
        witness.requests = 0;
        await writeFile(p, JSON.stringify(witness) + '\n', { mode: 0o600 });
      } else if (scenario === 'missing-state') {
        await unlink(join(dir, 'faisca-reservations.json'));
      } else {
        await writeFile(join(dir, '.faisca-reservations.lock'), 'synthetic lock', {
          flag: 'wx', mode: 0o600
        });
      }
      await assert.rejects(ledger.inspectReadOnly(), /review|lock|missing|mismatch/i);
    });
  }
});

test('R160 read-only operator CLI rejects CI and does not read a ledger without authorization', async () => {
  await assert.rejects(
    run(process.execPath, [
      new URL('../scripts/faisca-private-ledger-readonly-snapshot.mjs', import.meta.url).pathname,
      '0'.repeat(40)
    ], {
      env: { ...process.env, CI: 'true', GITHUB_ACTIONS: 'true',
        FAISCA_PRIVATE_LEDGER_AUDIT_ACK: 'YES_LOCAL_READONLY_NO_PROVIDER_PROOF' },
      timeout: 3000, maxBuffer: 1024
    }),
    error => {
      assert.equal(error.code, 2);
      assert.match(error.stderr, /R160 BLOCKED/);
      assert.equal(error.stdout, '');
      return true;
    }
  );
});

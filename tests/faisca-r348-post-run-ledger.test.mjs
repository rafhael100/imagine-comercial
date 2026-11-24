import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { inspectFaiscaPrivatePostRunLedger } from '../ops/faisca/openai/private-post-run-ledger.mjs';

async function fixture(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r348-'));
  try {
    await chmod(directory, 0o700);
    const ledger = createFaiscaLocalReservationLedger({ directory, maxRequests: 100, maxBudgetUsd: 10 });
    await fn(ledger, directory);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test('R348 empty ledger observation creates no evidence files and does not prove a run', async () => {
  await fixture(async (ledger, directory) => {
    const result = await inspectFaiscaPrivatePostRunLedger({ ledger });
    assert.equal(result.status, 'PRIVATE_LOCAL_LEDGER_READONLY_READY');
    assert.equal(result.requests, 0);
    assert.equal(result.processExitVerified, false);
    assert.equal(result.providerUsageReconciled, false);
    assert.deepEqual(await readdir(directory), []);
  });
});

test('R348 stable reserved counts remain local evidence, without refund or public GO', async () => {
  await fixture(async (ledger) => {
    await ledger.reserve(0.01);
    await ledger.reserve(0.02);
    const before = await ledger.inspectReadOnly();
    const result = await inspectFaiscaPrivatePostRunLedger({ ledger });
    assert.equal(result.status, 'PRIVATE_LOCAL_LEDGER_READONLY_READY');
    assert.equal(result.requests, 2);
    assert.equal(result.reservedMicros, before.reservedMicros);
    assert.equal(result.publicReady, false);
    assert.deepEqual(await ledger.inspectReadOnly(), before);
  });
});

test('R348 fenced ledger exposes only stable numeric evidence and requires reconciliation', async () => {
  await fixture(async (ledger) => {
    await ledger.reserve(0.01);
    await ledger.markOutcomeUncertain();
    const result = await inspectFaiscaPrivatePostRunLedger({ ledger });
    assert.equal(result.status, 'PRIVATE_LOCAL_LEDGER_RECONCILIATION_REQUIRED');
    assert.equal(result.requests, 1);
    assert.equal(result.localReadinessVerified, false);
    assert.equal(result.providerUsageReconciled, false);
    await assert.rejects(ledger.ready(), /outcome uncertain/);
  });
});

test('R348 counter drift fails closed, without printing counters or raw errors', async () => {
  await fixture(async (ledger) => {
    let reads = 0;
    const result = await inspectFaiscaPrivatePostRunLedger({ ledger: {
      ready: () => ledger.ready(),
      inspectReadOnly: async () => {
        if (++reads === 2) await ledger.reserve(0.01);
        return ledger.inspectReadOnly();
      }
    } });
    assert.equal(result.status, 'PRIVATE_LOCAL_LEDGER_UNVERIFIED');
    assert.equal(result.requests, null);
    assert.equal(result.reservedMicros, null);
    assert.equal(result.localCountersStable, false);
    assert.equal(result.operationalEffects, false);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { inspectFaiscaPrivateConversationSequence } from '../ops/faisca/openai/private-staging-sequence.mjs';
import {
  classifyFaiscaFailedPositiveReservations
} from '../ops/faisca/openai/private-ledger-sequence-proof.mjs';

// No PII, provider credentials, real host or network requests.
const snapshot = (requests = 0, reservedMicros = 0) => ({
  schema: 'faisca.private-ledger-readonly-snapshot.v1',
  requests, reservedMicros, limitRequests: 5, limitMicros: 1_000_000,
  atomicAcrossProcesses: false, providerUsageReconciled: false,
  publicReady: false, operationalEffects: false
});

test('R163 failed positive probe observes zero, one or two reservations without declaring provider use', () => {
  const before = snapshot(1, 10000);
  assert.equal(classifyFaiscaFailedPositiveReservations(before, snapshot(1, 10000)), 0);
  assert.equal(classifyFaiscaFailedPositiveReservations(before, snapshot(2, 20000)), 1);
  assert.equal(classifyFaiscaFailedPositiveReservations(before, snapshot(3, 30000)), 2);
  const classification = classifyFaiscaFailedPositiveReservations(before, snapshot(3, 30000));
  assert.equal(typeof classification, 'number');
  assert.equal(JSON.stringify(classification).includes('sk-'), false);
});

test('R163 rejects untrusted or drifting reservation observations; never grants refund or retry', () => {
  const before = snapshot(1, 10000);
  const bad = [
    snapshot(0, 5000),                    // rollback
    snapshot(1, 10001),                   // changed estimate without attempt
    snapshot(2, 10000),                   // extra attempt with zero estimate
    snapshot(3, 10001),                   // two attempts with one micro
    snapshot(4, 40000),                   // more than two attempts
    { ...snapshot(2, 20000), limitRequests: 9 },
    { ...snapshot(2, 20000), limitMicros: 999999 },
    { ...snapshot(2, 20000), requests: 9 },
    { ...snapshot(2, 20000), reservedMicros: -1 },
    { ...snapshot(2, 20000), providerUsageReconciled: true },
    { ...snapshot(2, 20000), publicReady: true },
    { ...snapshot(2, 20000), atomicAcrossProcesses: true },
    { ...snapshot(2, 20000), providerInvoiceId: 'synthetic-not-real' },
    Object.create(null)
  ];
  for (const input of bad) {
    assert.equal(classifyFaiscaFailedPositiveReservations(before, input), null);
  }
  assert.equal(classifyFaiscaFailedPositiveReservations(null, snapshot(2, 20000)), null);
  assert.equal(classifyFaiscaFailedPositiveReservations(before, null), null);
});

test('R163 accepts an already-partly-spent ledger but does not mistake totals for deltas', () => {
  assert.equal(classifyFaiscaFailedPositiveReservations(snapshot(3, 30000),
    snapshot(5, 50000)), 2);
  assert.equal(classifyFaiscaFailedPositiveReservations(snapshot(3, 30000),
    snapshot(5, 50000)), 2);
  assert.equal(classifyFaiscaFailedPositiveReservations(snapshot(5, 50000),
    snapshot(5, 50000)), 0);
  assert.equal(classifyFaiscaFailedPositiveReservations(snapshot(5, 50000),
    snapshot(6, 60000)), null);
});

test('R163 HTTP private sequence rejects an extra third reservation after failed positive reply', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r163-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ledger = createFaiscaLocalReservationLedger({
    directory, maxRequests: 4, maxBudgetUsd: 1
  });
  let positiveAttempts = 0;
  const lab = {
    answer: async () => { throw Error('unreachable synthetic scenario'); },
    answerPrivateConversation: async () => {
      positiveAttempts++;
      await ledger.reserve(0.01);
      await ledger.reserve(0.02);
      await ledger.reserve(0.03);
      throw Error('synthetic private positive failure; no provider involved');
    },
    inspect: () => ({ syntheticOnly: true })
  };
  const token = 'R163_PRIVATE_SYNTHETIC_ONLY_NO_REAL_BEARER';
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: server.address, reviewToken: token, enabled: true,
    inspectLedger: () => ledger.inspectReadOnly()
  });
  assert.equal(result.status, 'BLOCKED_LEDGER_GATE');
  assert.equal(result.negativeInputRejected, true);
  assert.equal(result.positiveEnvelopeAccepted, false);
  assert.equal(result.failedPositiveReservedRequests, null);
  assert.equal(result.localLedgerDeltasVerified, false);
  assert.equal(result.ledgerReconciled, false);
  assert.equal(result.publicReady, false);
  assert.equal(positiveAttempts, 1, 'never retry a failed positive request');
  assert.equal((await ledger.inspectReadOnly()).requests, 3);
  assert.equal(JSON.stringify(result).includes(token), false);
});

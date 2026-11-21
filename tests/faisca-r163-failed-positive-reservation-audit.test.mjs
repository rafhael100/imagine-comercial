import test from 'node:test';
import assert from 'node:assert/strict';
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

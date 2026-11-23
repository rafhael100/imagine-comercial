import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { reviewFaiscaPrivateUsage, FAISCA_USAGE_REVIEW_SCHEMA } from '../ops/faisca/openai/private-usage-review.mjs';

// R287: real local fsync reservations; operator-entered *fictional* totals.
// No actual OpenAI API, VPS, private chat text, token or billing access.
const aggregate = (requestCount, billedMicros) => ({
  schema: 'faisca.operator-entered-usage-aggregate.v1', requestCount, billedMicros
});

test('R287 real fsynced ledger can be compared read-only without issuing a paid request or unlocking dispatch', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r287-'));
  await chmod(directory, 0o700);
  try {
    const ledger = createFaiscaLocalReservationLedger({
      directory, maxRequests: 4, maxBudgetUsd: 1
    });
    await ledger.reserve(0.001);
    await ledger.reserve(0.002);
    const before = (await readdir(directory)).sort();
    const fileBytes = await Promise.all(before.map(name => readFile(join(directory, name))));
    const observed = await ledger.inspectReadOnly();
    assert.equal(observed.requests, 2);
    assert.equal(observed.reservedMicros, 3000);
    const review = reviewFaiscaPrivateUsage(observed, aggregate(2, 1200));
    assert.equal(review.schema, FAISCA_USAGE_REVIEW_SCHEMA);
    assert.equal(review.reviewStatus, 'manual_verification_required');
    assert.equal(review.estimatedMinusBilledMicros, 1800);
    assert.equal(review.reservedRequests, 2);
    assert.equal(review.operatorEnteredProviderRequests, 2);
    for (const field of [
      'sourceVerifiedIndependently', 'providerUsageReconciled',
      'canReleaseDurableFence', 'canResetQuota',
      'publicReady', 'operationalEffects'
    ]) assert.equal(review[field], false, field);
    assert.equal(Object.isFrozen(review), true);
    assert.equal(JSON.stringify(review).includes('sk-'), false);
    assert.deepEqual((await readdir(directory)).sort(), before);
    const after = await Promise.all(before.map(name => readFile(join(directory, name))));
    for (let i = 0; i < before.length; i++) assert.deepEqual(after[i], fileBytes[i]);
    assert.equal((await ledger.inspectReadOnly()).requests, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('R287 unknown or contradictory synthetic provider totals must never be classified as reconciled', () => {
  const snapshot = {
    schema: 'faisca.private-ledger-readonly-snapshot.v1',
    requests: 2, reservedMicros: 3000, limitRequests: 4, limitMicros: 1_000_000,
    atomicAcrossProcesses: false, providerUsageReconciled: false,
    publicReady: false, operationalEffects: false
  };
  for (const [input, status] of [
    [aggregate(1, 500), 'reservations_without_reported_provider_calls'],
    [aggregate(3, 400), 'provider_exceeds_reservations'],
    [aggregate(2, 3001), 'provider_exceeds_reservations'],
    [aggregate(0, 0), 'reservations_without_reported_provider_calls'],
    [aggregate(2, 3000), 'manual_verification_required']
  ]) {
    const result = reviewFaiscaPrivateUsage(snapshot, input);
    assert.equal(result.reviewStatus, status);
    assert.equal(result.providerUsageReconciled, false);
    assert.equal(result.canReleaseDurableFence, false);
    assert.equal(result.publicReady, false);
  }
});

test('R287 refuses invented reconciliation proof, identifiers, malformed values and accessor side effects', () => {
  const snapshot = {
    schema: 'faisca.private-ledger-readonly-snapshot.v1',
    requests: 0, reservedMicros: 0, limitRequests: 4, limitMicros: 1_000_000,
    atomicAcrossProcesses: false, providerUsageReconciled: false,
    publicReady: false, operationalEffects: false
  };
  const valid = aggregate(0, 0);
  let getterCalled = false;
  const malicious = Object.defineProperty({ ...valid }, 'requestCount', {
    get() { getterCalled = true; throw new Error('Getter must not run'); },
    enumerable: true
  });
  const bad = [
    { ...valid, accountEmail: 'example@example.invalid' },
    { ...valid, apiKey: 'sk-not-a-key' },
    { ...valid, providerVerified: true },
    { ...valid, billedMicros: -1 },
    { ...valid, billedMicros: 0.2 },
    { ...valid, requestCount: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, requestCount: NaN },
    { ...valid, schema: 'untrusted' },
    malicious,
    Object.assign(Object.create(Date.prototype), valid),
    null,
    []
  ];
  for (const item of bad) assert.throws(() => reviewFaiscaPrivateUsage(snapshot, item), TypeError);
  assert.equal(getterCalled, false);
  for (const unsafe of [
    { ...snapshot, publicReady: true },
    { ...snapshot, providerUsageReconciled: true },
    { ...snapshot, localIdentity: 'operator' },
    { ...snapshot, requests: -1 },
    { ...snapshot, reservedMicros: 999999999 }
  ]) assert.throws(() => reviewFaiscaPrivateUsage(unsafe, valid), TypeError);
});

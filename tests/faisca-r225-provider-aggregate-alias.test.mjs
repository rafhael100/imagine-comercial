import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditFaiscaPrivateProviderAggregate
} from '../ops/faisca/openai/private-provider-aggregate-audit.mjs';

function snapshot(requests = 0, reservedMicros = 0) {
  return {
    schema: 'faisca.private-ledger-readonly-snapshot.v1',
    requests, reservedMicros, limitRequests: 4, limitMicros: 1_000_000,
    atomicAcrossProcesses: false, providerUsageReconciled: false,
    publicReady: false, operationalEffects: false
  };
}
function evidence(totalRequests = 0, actualCostMicros = 0) {
  return {
    schema: 'faisca.private-provider-aggregate-evidence.v1',
    scope: 'isolated_private_review_only',
    totalRequests, lunaRequests: Number(totalRequests >= 1),
    terraRequests: Number(totalRequests === 2), actualCostMicros,
    publicReady: false, operationalEffects: false
  };
}
function safe(result) {
  assert.equal(result.providerUsageReconciled, false);
  assert.equal(result.externalAttestationVerified, false);
  assert.equal(result.publicReady, false);
  assert.equal(result.operationalEffects, false);
  assert.equal(JSON.stringify(result).includes('sk-'), false);
}

test('R225 never accepts one mutable object as before/after aggregate evidence', () => {
  const shared = snapshot();
  const baseline = shared; // A single inspector instance accidentally reused.
  shared.requests = 1;
  shared.reservedMicros = 10_000;
  const result = auditFaiscaPrivateProviderAggregate({
    before: baseline, after: shared, evidence: evidence(0), outcome: 'rejected'
  });
  assert.equal(result.status, 'BLOCKED_ALIASED_LEDGER_SNAPSHOTS');
  assert.equal(result.localRequests, null);
  assert.equal(result.localReservedMicros, null);
  safe(result);
});

test('R225 rejects accessor-backed and symbolic numeric evidence', () => {
  for (const field of ['requests', 'reservedMicros']) {
    const hostile = snapshot();
    Object.defineProperty(hostile, field, {
      enumerable: true, get() { throw Error('synthetic accessor must not execute'); }
    });
    const result = auditFaiscaPrivateProviderAggregate({
      before: hostile, after: snapshot(), evidence: evidence(), outcome: 'rejected'
    });
    assert.equal(result.status, 'BLOCKED_INVALID_INPUT');
    safe(result);
  }
  const hostile = snapshot();
  hostile[Symbol('hidden')] = 'not a reviewed schema field';
  const result = auditFaiscaPrivateProviderAggregate({
    before: snapshot(), after: hostile, evidence: evidence(), outcome: 'rejected'
  });
  assert.equal(result.status, 'BLOCKED_INVALID_INPUT');
  safe(result);
});

test('R225 independent unchanged observations still allow rejected fixture audit', () => {
  const result = auditFaiscaPrivateProviderAggregate({
    before: snapshot(), after: snapshot(), evidence: evidence(), outcome: 'rejected'
  });
  assert.equal(result.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(result.localRequests, 0);
  assert.equal(result.localReservedMicros, 0);
  safe(result);
});

test('R225 two independently observed provider reservations keep numeric discrepancy checks', () => {
  const base = { before: snapshot(), after: snapshot(2, 40_000), outcome: 'success' };
  const good = auditFaiscaPrivateProviderAggregate({
    ...base, evidence: evidence(2, 30_000)
  });
  assert.equal(good.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(good.localRequests, 2);
  assert.equal(good.localReservedMicros, 40_000);
  const exceeded = auditFaiscaPrivateProviderAggregate({
    ...base, evidence: evidence(2, 40_001)
  });
  assert.equal(exceeded.status, 'BLOCKED_COST_EXCEEDS_RESERVATION');
  safe(good);
  safe(exceeded);
});

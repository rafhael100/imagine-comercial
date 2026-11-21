import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditFaiscaPrivateProviderAggregate,
  FAISCA_PROVIDER_AGGREGATE_AUDIT_SCHEMA
} from '../ops/faisca/openai/private-provider-aggregate-audit.mjs';

const snapshot = (requests, reservedMicros) => ({
  schema: 'faisca.private-ledger-readonly-snapshot.v1',
  requests, reservedMicros, limitRequests: 4, limitMicros: 1_000_000,
  atomicAcrossProcesses: false, providerUsageReconciled: false,
  publicReady: false, operationalEffects: false
});
const aggregate = (totalRequests, actualCostMicros = 10000) => ({
  schema: 'faisca.private-provider-aggregate-evidence.v1',
  scope: 'isolated_private_review_only',
  totalRequests, lunaRequests: Number(totalRequests >= 1),
  terraRequests: Number(totalRequests === 2), actualCostMicros,
  publicReady: false, operationalEffects: false
});
function verifySafe(report) {
  assert.equal(report.schema, FAISCA_PROVIDER_AGGREGATE_AUDIT_SCHEMA);
  assert.equal(report.providerUsageReconciled, false);
  assert.equal(report.externalAttestationVerified, false);
  assert.equal(report.publicReady, false);
  assert.equal(report.operationalEffects, false);
  const raw = JSON.stringify(report);
  for (const secret of ['sk-', 'operator@example.invalid', 'private-token', 'prompt']) {
    assert.equal(raw.includes(secret), false);
  }
}

test('R165 compares only two reservations and numeric run-scoped aggregate; never marks provider reconciled', () => {
  const report = auditFaiscaPrivateProviderAggregate({
    before: snapshot(1, 10000), after: snapshot(3, 50000),
    outcome: 'success', evidence: aggregate(2, 30000)
  });
  assert.equal(report.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(report.localRequests, 2);
  assert.equal(report.localReservedMicros, 40000);
  verifySafe(report);
});

test('R165 classifies synthetic rejected, failed Luna and failed Terra trajectories', () => {
  const entries = [
    ['rejected', snapshot(0, 0), snapshot(0, 0), aggregate(0, 0)],
    ['failed_luna', snapshot(0, 0), snapshot(1, 14000), aggregate(1, 12000)],
    ['failed_terra', snapshot(1, 20000), snapshot(3, 50000), aggregate(2, 28000)]
  ];
  for (const [outcome, before, after, evidence] of entries) {
    const report = auditFaiscaPrivateProviderAggregate({ outcome, before, after, evidence });
    assert.equal(report.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
    verifySafe(report);
  }
});

test('R165 blocks mismatching counts, actual cost above reservation, rollback and incompatible ledgers', () => {
  const baseline = { before: snapshot(1, 10000), after: snapshot(3, 50000),
    outcome: 'success', evidence: aggregate(2, 20000) };
  for (const [change, status] of [
    [{ evidence: aggregate(1, 10000) }, 'BLOCKED_REQUEST_MISMATCH'],
    [{ evidence: aggregate(2, 40001) }, 'BLOCKED_COST_EXCEEDS_RESERVATION'],
    [{ after: snapshot(0, 10000) }, 'BLOCKED_LEDGER_DELTA'],
    [{ after: { ...snapshot(3, 50000), limitMicros: 800000 } }, 'BLOCKED_INVALID_INPUT'],
    [{ outcome: 'rejected' }, 'BLOCKED_REQUEST_MISMATCH'],
    [{ outcome: 'paid_success' }, 'BLOCKED_INVALID_INPUT']
  ]) {
    const report = auditFaiscaPrivateProviderAggregate({ ...baseline, ...change });
    assert.equal(report.status, status);
    verifySafe(report);
  }
});

test('R165 refuses unscoped provider account aggregates, identifiers, unsafe shape and fabricated confidence', () => {
  const baseline = { before: snapshot(0, 0), after: snapshot(2, 40000),
    outcome: 'success' };
  const good = aggregate(2, 20000);
  const bad = [null, { ...good, scope: 'full_account' },
    { ...good, userEmail: 'operator@example.invalid' },
    { ...good, providerUsageReconciled: true },
    { ...good, operationalEffects: true },
    { ...good, publicReady: true },
    { ...good, actualCostMicros: -1 },
    { ...good, actualCostMicros: 10000001 },
    { ...good, totalRequests: 2, lunaRequests: 0, terraRequests: 2 },
    { ...good, totalRequests: 2, lunaRequests: 2, terraRequests: 0 },
    Object.assign(Object.create(null), good)
  ];
  for (const evidence of bad) {
    const report = auditFaiscaPrivateProviderAggregate({ ...baseline, evidence });
    assert.equal(report.status, 'BLOCKED_INVALID_EVIDENCE');
    verifySafe(report);
  }
});

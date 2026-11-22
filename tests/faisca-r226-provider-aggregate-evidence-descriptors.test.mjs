import test from 'node:test';
import assert from 'node:assert/strict';
import { auditFaiscaPrivateProviderAggregate } from '../ops/faisca/openai/private-provider-aggregate-audit.mjs';

const ledger = (requests = 0, reservedMicros = 0) => ({
  schema: 'faisca.private-ledger-readonly-snapshot.v1',
  requests, reservedMicros, limitRequests: 4, limitMicros: 1_000_000,
  atomicAcrossProcesses: false, providerUsageReconciled: false,
  publicReady: false, operationalEffects: false
});
const evidence = (cost = 20_000) => ({
  schema: 'faisca.private-provider-aggregate-evidence.v1',
  scope: 'isolated_private_review_only',
  totalRequests: 2, lunaRequests: 1, terraRequests: 1,
  actualCostMicros: cost, publicReady: false, operationalEffects: false
});
function run(value) {
  return auditFaiscaPrivateProviderAggregate({
    before: ledger(), after: ledger(2, 40_000),
    evidence: value, outcome: 'success'
  });
}
function safe(result) {
  assert.equal(result.publicReady, false);
  assert.equal(result.operationalEffects, false);
  assert.equal(result.providerUsageReconciled, false);
  assert.equal(result.externalAttestationVerified, false);
  assert.equal(JSON.stringify(result).includes('R226_FAKE_PRIVATE_SECRET'), false);
}

test('R226 never executes evidence accessors, even when they would return valid values', () => {
  let invoked = 0;
  for (const field of ['totalRequests', 'lunaRequests', 'terraRequests',
    'actualCostMicros', 'scope', 'schema', 'publicReady', 'operationalEffects']) {
    const hostile = evidence();
    const validValue = hostile[field];
    Object.defineProperty(hostile, field, {
      enumerable: true, configurable: true,
      get() { invoked++; return validValue; }
    });
    const result = run(hostile);
    assert.equal(result.status, 'BLOCKED_INVALID_EVIDENCE', field);
    safe(result);
  }
  assert.equal(invoked, 0, 'operator-supplied getters must never execute');
});

test('R226 rejects throwing evidence descriptors without propagating secret-bearing errors', () => {
  const hostile = evidence();
  Object.defineProperty(hostile, 'actualCostMicros', {
    enumerable: true,
    get() { throw Error('R226_FAKE_PRIVATE_SECRET'); }
  });
  const result = run(hostile);
  assert.equal(result.status, 'BLOCKED_INVALID_EVIDENCE');
  safe(result);
});

test('R226 rejects symbols and nonenumerable or foreign evidence keys', () => {
  const symbol = evidence();
  symbol[Symbol('shadow-cost')] = 123;
  const hidden = evidence();
  Object.defineProperty(hidden, 'hiddenKey', { value: 'R226_FAKE_PRIVATE_SECRET' });
  const foreign = { ...evidence(), operatorEmail: 'private@example.invalid' };
  for (const invalid of [symbol, hidden, foreign]) {
    const result = run(invalid);
    assert.equal(result.status, 'BLOCKED_INVALID_EVIDENCE');
    safe(result);
  }
});

test('R226 closes on proxy introspection failure; no throw, message, or approval', () => {
  for (const handler of [
    { ownKeys() { throw Error('R226_FAKE_PRIVATE_SECRET'); } },
    { getOwnPropertyDescriptor() { throw Error('R226_FAKE_PRIVATE_SECRET'); } },
    { getPrototypeOf() { throw Error('R226_FAKE_PRIVATE_SECRET'); } }
  ]) {
    const result = run(new Proxy(evidence(), handler));
    assert.equal(result.status, 'BLOCKED_INVALID_EVIDENCE');
    safe(result);
  }
});

test('R226 preserves legitimate synthetic numeric comparison and independent review gate', () => {
  const valid = evidence();
  const approvedForReview = run(valid);
  assert.equal(approvedForReview.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(approvedForReview.localRequests, 2);
  assert.equal(approvedForReview.localReservedMicros, 40_000);
  safe(approvedForReview);
  valid.actualCostMicros = 40_001;
  const expensive = run(valid);
  assert.equal(expensive.status, 'BLOCKED_COST_EXCEEDS_RESERVATION');
  safe(expensive);
});

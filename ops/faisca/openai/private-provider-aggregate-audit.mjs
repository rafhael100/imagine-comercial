import {
  captureFaiscaLocalLedgerSnapshot,
  classifyFaiscaFailedPositiveReservations
} from './private-ledger-sequence-proof.mjs';

export const FAISCA_PROVIDER_AGGREGATE_AUDIT_SCHEMA =
  'faisca.private-provider-aggregate-audit.v1';
const EVIDENCE_SCHEMA = 'faisca.private-provider-aggregate-evidence.v1';
const EVIDENCE_KEYS = [
  'actualCostMicros', 'lunaRequests', 'operationalEffects', 'publicReady',
  'scope', 'schema', 'terraRequests', 'totalRequests'
].sort().join(',');

const plainObject = value => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const validCount = count => Number.isSafeInteger(count) && count >= 0 && count <= 2;

/**
 * R226: provider aggregates are operator-supplied evidence, never trusted
 * account records. Read ONLY reviewed own data descriptors once. A getter,
 * symbol, extra key, proxy trap or a later mutation must not influence the
 * decision or execute arbitrary code during validation.
 */
function captureAggregateEvidence(value) {
  try {
    if (!plainObject(value) ||
        Reflect.ownKeys(value).length !== 8 ||
        Object.keys(value).sort().join(',') !== EVIDENCE_KEYS) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot = {};
    for (const key of EVIDENCE_KEYS.split(',')) {
      const descriptor = descriptors[key];
      if (!descriptor || !Object.hasOwn(descriptor, 'value') ||
          descriptor.enumerable !== true) return null;
      snapshot[key] = descriptor.value;
    }
    if (snapshot.schema !== EVIDENCE_SCHEMA ||
        snapshot.scope !== 'isolated_private_review_only' ||
        snapshot.publicReady !== false || snapshot.operationalEffects !== false ||
        !validCount(snapshot.totalRequests) || !validCount(snapshot.lunaRequests) ||
        !validCount(snapshot.terraRequests) ||
        snapshot.lunaRequests + snapshot.terraRequests !== snapshot.totalRequests ||
        snapshot.lunaRequests > 1 || snapshot.terraRequests > 1 ||
        (snapshot.terraRequests && !snapshot.lunaRequests) ||
        !Number.isSafeInteger(snapshot.actualCostMicros) ||
        snapshot.actualCostMicros < 0 || snapshot.actualCostMicros > 10_000_000 ||
        (snapshot.totalRequests === 0 && snapshot.actualCostMicros !== 0)) return null;
    return Object.freeze(snapshot);
  } catch {
    // An untrusted proxy may throw in introspection: always fail closed.
    return null;
  }
}

/**
 * Compare a read-only R160 ledger delta with a *separately supplied*,
 * strictly numeric provider usage aggregate for one isolated private trial.
 * Never reads network, keys, messages, account totals or provider data.
 * This is a discrepancy detector, NOT cryptographic provider attestation,
 * actual billing proof, reconciliation, refund or a release gate approval.
 */
export function auditFaiscaPrivateProviderAggregate({ before, after, evidence, outcome } = {}) {
  // R225: a single reused mutable object cannot be both independent
  // "before" and "after" evidence. Reject identity aliasing explicitly,
  // even for a zero-reservation rejected attempt; never report a match.
  const aliasedEvidence = before !== null && before !== undefined && before === after;
  const prior = aliasedEvidence ? null : captureFaiscaLocalLedgerSnapshot(before);
  const next = aliasedEvidence ? null : captureFaiscaLocalLedgerSnapshot(after);
  let status = aliasedEvidence
    ? 'BLOCKED_ALIASED_LEDGER_SNAPSHOTS' : 'BLOCKED_INVALID_INPUT';
  let localRequests = null;
  let localReservedMicros = null;
  if (!aliasedEvidence &&
      ['success', 'failed_luna', 'failed_terra', 'rejected'].includes(outcome) &&
      prior && next &&
      prior.limitRequests === next.limitRequests &&
      prior.limitMicros === next.limitMicros) {
    localRequests = classifyFaiscaFailedPositiveReservations(prior, next);
    if (localRequests === null) {
      status = 'BLOCKED_LEDGER_DELTA';
    } else {
      localReservedMicros = next.reservedMicros - prior.reservedMicros;
      const aggregate = captureAggregateEvidence(evidence);
      if (!aggregate) {
        status = 'BLOCKED_INVALID_EVIDENCE';
      } else {
        const expected = outcome === 'success' ? 2 :
          outcome === 'failed_terra' ? 2 :
            outcome === 'failed_luna' ? 1 : 0;
        if (localRequests !== expected || aggregate.totalRequests !== expected ||
            aggregate.lunaRequests !== (expected >= 1 ? 1 : 0) ||
            aggregate.terraRequests !== (expected === 2 ? 1 : 0)) {
          status = 'BLOCKED_REQUEST_MISMATCH';
        } else if (aggregate.actualCostMicros > localReservedMicros) {
          status = 'BLOCKED_COST_EXCEEDS_RESERVATION';
        } else {
          status = 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW';
        }
      }
    }
  }
  return Object.freeze({
    schema: FAISCA_PROVIDER_AGGREGATE_AUDIT_SCHEMA,
    status,
    localRequests,
    localReservedMicros,
    // No field claims actual provider consumption, validated invoicing or GO.
    providerUsageReconciled: false,
    externalAttestationVerified: false,
    publicReady: false,
    operationalEffects: false
  });
}

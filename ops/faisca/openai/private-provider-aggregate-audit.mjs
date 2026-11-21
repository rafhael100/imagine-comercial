import {
  validFaiscaLocalLedgerSnapshot,
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

function validAggregateEvidence(value) {
  return plainObject(value) && Object.keys(value).sort().join(',') === EVIDENCE_KEYS &&
    value.schema === EVIDENCE_SCHEMA &&
    value.scope === 'isolated_private_review_only' &&
    value.publicReady === false && value.operationalEffects === false &&
    validCount(value.totalRequests) && validCount(value.lunaRequests) &&
    validCount(value.terraRequests) &&
    value.lunaRequests + value.terraRequests === value.totalRequests &&
    value.lunaRequests <= 1 && value.terraRequests <= 1 &&
    !(value.terraRequests && !value.lunaRequests) &&
    Number.isSafeInteger(value.actualCostMicros) &&
    value.actualCostMicros >= 0 && value.actualCostMicros <= 10_000_000 &&
    (value.totalRequests !== 0 || value.actualCostMicros === 0);
}

/**
 * Compare a read-only R160 ledger delta with a *separately supplied*,
 * strictly numeric provider usage aggregate for one isolated private trial.
 * Never reads network, keys, messages, account totals or provider data.
 * This is a discrepancy detector, NOT cryptographic provider attestation,
 * actual billing proof, reconciliation, refund or a release gate approval.
 */
export function auditFaiscaPrivateProviderAggregate({ before, after, evidence, outcome } = {}) {
  let status = 'BLOCKED_INVALID_INPUT';
  let localRequests = null;
  let localReservedMicros = null;
  if (['success', 'failed_luna', 'failed_terra', 'rejected'].includes(outcome) &&
      validFaiscaLocalLedgerSnapshot(before) &&
      validFaiscaLocalLedgerSnapshot(after) &&
      before.limitRequests === after.limitRequests &&
      before.limitMicros === after.limitMicros) {
    localRequests = classifyFaiscaFailedPositiveReservations(before, after);
    if (localRequests === null) {
      status = 'BLOCKED_LEDGER_DELTA';
    } else {
      localReservedMicros = after.reservedMicros - before.reservedMicros;
      if (!validAggregateEvidence(evidence)) {
        status = 'BLOCKED_INVALID_EVIDENCE';
      } else {
        const expected = outcome === 'success' ? 2 :
          outcome === 'failed_terra' ? 2 :
            outcome === 'failed_luna' ? 1 : 0;
        if (localRequests !== expected || evidence.totalRequests !== expected ||
            evidence.lunaRequests !== (expected >= 1 ? 1 : 0) ||
            evidence.terraRequests !== (expected === 2 ? 1 : 0)) {
          status = 'BLOCKED_REQUEST_MISMATCH';
        } else if (evidence.actualCostMicros > localReservedMicros) {
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

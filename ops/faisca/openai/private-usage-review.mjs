// R287 — REVIEW ONLY: compare fsynced reservation totals with *operator-entered*
// aggregate provider usage, never with customer messages or OpenAI credentials.
// These numbers are not a provider-signed receipt and never release a lock,
// uncertain dispatch, quota or public feature flag.
const SNAPSHOT_SCHEMA = 'faisca.private-ledger-readonly-snapshot.v1';
const AGGREGATE_SCHEMA = 'faisca.operator-entered-usage-aggregate.v1';
export const FAISCA_USAGE_REVIEW_SCHEMA = 'faisca.private-usage-review-only.v1';

function exactData(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError('Aggregate review requires plain objects.');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const names = Reflect.ownKeys(value);
  if (names.length !== expected.length || names.some(name =>
    typeof name !== 'string' || !expected.includes(name) ||
    !Object.hasOwn(descriptors[name], 'value'))) {
    throw new TypeError('Aggregate review forbids extra fields or getters.');
  }
  return Object.fromEntries(expected.map(name => [name, descriptors[name].value]));
}
function integer(value, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

/**
 * Strictly read-only, deterministic comparison of two untrusted aggregates.
 * This function does not read OpenAI, inspect a VPS, persist evidence or
 * reconcile billing. The operator must independently verify provider records.
 */
export function reviewFaiscaPrivateUsage(snapshotInput, aggregateInput) {
  const snapshot = exactData(snapshotInput, [
    'schema', 'requests', 'reservedMicros', 'limitRequests', 'limitMicros',
    'atomicAcrossProcesses', 'providerUsageReconciled',
    'publicReady', 'operationalEffects'
  ]);
  const aggregate = exactData(aggregateInput, [
    'schema', 'requestCount', 'billedMicros'
  ]);
  if (snapshot.schema !== SNAPSHOT_SCHEMA ||
      snapshot.atomicAcrossProcesses !== false ||
      snapshot.providerUsageReconciled !== false ||
      snapshot.publicReady !== false || snapshot.operationalEffects !== false ||
      !integer(snapshot.limitRequests, 1, 100) ||
      !integer(snapshot.limitMicros, 1, 10_000_000) ||
      !integer(snapshot.requests, 0, snapshot.limitRequests) ||
      !integer(snapshot.reservedMicros, 0, snapshot.limitMicros) ||
      aggregate.schema !== AGGREGATE_SCHEMA ||
      !integer(aggregate.requestCount, 0, 1_000_000) ||
      !integer(aggregate.billedMicros, 0, 1_000_000_000)) {
    throw new TypeError('Unsupported or unsafe private usage aggregates.');
  }
  // A mismatch could indicate late billing, another client/project sharing
  // a provider account, incomplete reporting, or an accounting incident.
  // Matching counters likewise NEVER prove that costs were independently
  // verified, that the ledger is unlocked, or that staging is deployed.
  const reviewStatus =
    aggregate.requestCount > snapshot.requests ||
    aggregate.billedMicros > snapshot.reservedMicros
      ? 'provider_exceeds_reservations'
      : aggregate.requestCount < snapshot.requests
        ? 'reservations_without_reported_provider_calls'
        : 'manual_verification_required';
  return Object.freeze({
    schema: FAISCA_USAGE_REVIEW_SCHEMA,
    reviewStatus,
    reservedRequests: snapshot.requests,
    operatorEnteredProviderRequests: aggregate.requestCount,
    reservedMicros: snapshot.reservedMicros,
    operatorEnteredBilledMicros: aggregate.billedMicros,
    estimatedMinusBilledMicros: snapshot.reservedMicros - aggregate.billedMicros,
    sourceVerifiedIndependently: false,
    providerUsageReconciled: false,
    canReleaseDurableFence: false,
    canResetQuota: false,
    publicReady: false,
    operationalEffects: false
  });
}

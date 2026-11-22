// R161: deliberately narrow, offline-only comparison of three local
// read-only R160 snapshots. These values are NOT verified provider usage,
// do not prove which process reserved quota and never authorize GO público.
const SCHEMA = 'faisca.private-ledger-readonly-snapshot.v1';
const FIELDS = [
  'atomicAcrossProcesses', 'limitMicros', 'limitRequests',
  'operationalEffects', 'providerUsageReconciled', 'publicReady',
  'requests', 'reservedMicros', 'schema'
].sort().join(',');

export function validFaiscaLocalLedgerSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).sort().join(',') !== FIELDS ||
      value.schema !== SCHEMA ||
      value.atomicAcrossProcesses !== false ||
      value.providerUsageReconciled !== false ||
      value.publicReady !== false ||
      value.operationalEffects !== false ||
      !Number.isSafeInteger(value.limitRequests) || value.limitRequests < 1 ||
      value.limitRequests > 100 ||
      !Number.isSafeInteger(value.limitMicros) || value.limitMicros < 1 ||
      value.limitMicros > 10_000_000 ||
      !Number.isSafeInteger(value.requests) || value.requests < 0 ||
      value.requests > value.limitRequests ||
      !Number.isSafeInteger(value.reservedMicros) || value.reservedMicros < 0 ||
      value.reservedMicros > value.limitMicros) return false;
  return true;
}

/**
 * R224: an inspector may accidentally reuse a mutable object for successive
 * reads. A live object is not historical evidence: a later in-place update
 * could silently rewrite the "before" counters and hide a reservation.
 * Copy ONLY the nine reviewed own data properties, reject accessors and
 * extra/symbol keys, and freeze the returned point-in-time observation.
 * This does not establish process atomicity or provider billing.
 */
export function captureFaiscaLocalLedgerSnapshot(value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.getPrototypeOf(value) !== Object.prototype ||
        Reflect.ownKeys(value).length !== 9 ||
        Object.keys(value).sort().join(',') !== FIELDS) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot = {};
    for (const key of FIELDS.split(',')) {
      const descriptor = descriptors[key];
      if (!descriptor || !Object.hasOwn(descriptor, 'value') ||
          descriptor.enumerable !== true) return null;
      snapshot[key] = descriptor.value;
    }
    return validFaiscaLocalLedgerSnapshot(snapshot) ? Object.freeze(snapshot) : null;
  } catch {
    return null;
  }
}

export function matchFaiscaLocalLedgerDelta(before, after, expectedRequests) {
  if (!validFaiscaLocalLedgerSnapshot(before) ||
      !validFaiscaLocalLedgerSnapshot(after) ||
      (expectedRequests !== 0 && expectedRequests !== 2) ||
      before.limitRequests !== after.limitRequests ||
      before.limitMicros !== after.limitMicros ||
      after.requests !== before.requests + expectedRequests ||
      after.reservedMicros < before.reservedMicros) return false;

  // A rejected synthetic question must consume neither a request nor money.
  if (expectedRequests === 0) {
    return after.reservedMicros === before.reservedMicros;
  }
  // A successful synthetic private answer must reserve Luna AND Terra.
  // An extra or missing reservation, or a zero-cost fabricated reservation,
  // is a NO-GO. This does not establish upstream API or invoice use.
  return after.reservedMicros - before.reservedMicros >= 2;
}


/**
 * R163: after a failed positive HTTP envelope, observe whether the
 * single-host ledger reserved zero, one, or two attempts. This is a
 * strictly bounded forensic clue, NOT upstream transport or billing proof.
 * Any competing writer or unexpected delta requires manual reconciliation.
 * No credit is refunded and no automatic retry is authorized.
 */
export function classifyFaiscaFailedPositiveReservations(before, after) {
  if (!validFaiscaLocalLedgerSnapshot(before) ||
      !validFaiscaLocalLedgerSnapshot(after) ||
      before.limitRequests !== after.limitRequests ||
      before.limitMicros !== after.limitMicros ||
      after.requests < before.requests ||
      after.reservedMicros < before.reservedMicros) return null;
  const requests = after.requests - before.requests;
  const micros = after.reservedMicros - before.reservedMicros;
  if (requests > 2 ||
      (requests === 0 && micros !== 0) ||
      (requests > 0 && micros < requests)) return null;
  return requests;
}


/**
 * R164: cheap fail-closed capacity floor before starting the positive
 * synthetic exchange. Two provider stages need two durable request slots.
 * The 2-micro floor detects exhausted budgets, not price sufficiency:
 * actual model dispatch reserves its full estimated cost atomically.
 */
export function hasFaiscaLocalTwoModelHeadroom(snapshot) {
  return validFaiscaLocalLedgerSnapshot(snapshot) &&
    snapshot.limitRequests - snapshot.requests >= 2 &&
    snapshot.limitMicros - snapshot.reservedMicros >= 2;
}

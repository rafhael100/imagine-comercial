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

// R349: compare independently collected local numeric observations only.
// No provider attribution, process proof, credentials, retry, or operational GO.
const fields = [
  'schema','status','localCountersStable','localReadinessVerified','requests',
  'reservedMicros','limitRequests','limitMicros','processExitVerified',
  'providerUsageReconciled','atomicAcrossProcesses','operationalEffects','publicReady'
].sort().join(',');
function valid(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
      Reflect.ownKeys(value).length !== 13 || Object.keys(value).sort().join(',') !== fields) return false;
  const desc = Object.getOwnPropertyDescriptors(value);
  if (Object.values(desc).some(d => !Object.hasOwn(d,'value') || !d.enumerable)) return false;
  return value.schema === 'faisca.private-post-run-ledger.v1' &&
    value.status === 'PRIVATE_LOCAL_LEDGER_READONLY_READY' &&
    value.localCountersStable === true && value.localReadinessVerified === true &&
    ['processExitVerified','providerUsageReconciled','atomicAcrossProcesses','operationalEffects','publicReady']
      .every(key => value[key] === false) &&
    Number.isSafeInteger(value.limitRequests) && value.limitRequests >= 1 && value.limitRequests <= 100 &&
    Number.isSafeInteger(value.limitMicros) && value.limitMicros >= 1 && value.limitMicros <= 10_000_000 &&
    Number.isSafeInteger(value.requests) && value.requests >= 0 && value.requests <= value.limitRequests &&
    Number.isSafeInteger(value.reservedMicros) && value.reservedMicros >= value.requests &&
    value.reservedMicros <= value.limitMicros &&
    (value.requests !== 0 || value.reservedMicros === 0);
}

export function compareFaiscaPrivateLedgerWindow(before, after, expectedRequests) {
  let verified = false;
  let requestDelta = null, reservedMicrosDelta = null;
  try {
    if ((expectedRequests === 2 || expectedRequests === 4) && valid(before) && valid(after) &&
        before.limitRequests === after.limitRequests && before.limitMicros === after.limitMicros) {
      const requests = after.requests - before.requests;
      const micros = after.reservedMicros - before.reservedMicros;
      if (requests === expectedRequests && micros >= requests) {
        verified = true;
        requestDelta = requests;
        reservedMicrosDelta = micros;
      }
    }
  } catch {}
  return Object.freeze({
    schema: 'faisca.private-ledger-window.v1',
    status: verified ? 'PRIVATE_LOCAL_WINDOW_DELTA_MATCHED' : 'PRIVATE_LOCAL_WINDOW_RECONCILIATION_REQUIRED',
    localDeltaVerified: verified, requestDelta, reservedMicrosDelta,
    sameLedgerIdentityVerified: false, reviewedShaVerified: false,
    processExitVerified: false, providerUsageReconciled: false,
    atomicAcrossProcesses: false, operationalEffects: false, publicReady: false
  });
}

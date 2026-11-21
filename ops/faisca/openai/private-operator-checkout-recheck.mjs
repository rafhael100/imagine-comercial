/**
 * R174: compare two isolated Git observations around a sensitive evidence read.
 * Never treat a clean checkout, or identical observations, as host attestation.
 */
export function hasFaiscaStableOperatorCheckout(before, after, expectedSha) {
  if (typeof expectedSha !== 'string' || !/^[0-9a-f]{40}$/u.test(expectedSha)) return false;
  const safe = snapshot => snapshot !== null && typeof snapshot === 'object' &&
    !Array.isArray(snapshot) && Object.getPrototypeOf(snapshot) === Object.prototype &&
    Object.keys(snapshot).sort().join(',') === 'dirty,head,indexSafe,trackedIndex' &&
    snapshot.head === expectedSha && snapshot.dirty === '' &&
    snapshot.indexSafe === true && typeof snapshot.trackedIndex === 'string' &&
    snapshot.trackedIndex.length > 0;
  return safe(before) && safe(after) && before.trackedIndex === after.trackedIndex;
}

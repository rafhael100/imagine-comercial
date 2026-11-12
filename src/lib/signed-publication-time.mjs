/**
 * F218: pure, side-effect-free not-before gate for signed releases,
 * protected build preflight and independent copied-package verification.
 * Importing this module must never run eager Astro catalog validation.
 */
// F201: a signed future-dated publication must not become public early.
// Five minutes covers small operator/runner clock skew, never a scheduled
// release. A signature authenticates bytes, not editorial go-live timing.
const MAX_CLOCK_SKEW_MS=5*60*1000;

// F212: share the same not-before guard between staging build and
// signed offline transition review. A signature alone cannot schedule go-live.
export function enforceSignedPublicationTime(publishedAt,nowMs=Date.now()){
  if(!Number.isSafeInteger(nowMs)||nowMs<1)
    throw new Error('build catalog: invalid verification time');
  const signedPublicationMs=Date.parse(publishedAt);
  if(!Number.isFinite(signedPublicationMs)||
      signedPublicationMs-nowMs>MAX_CLOCK_SKEW_MS)
    throw new Error('build catalog: signed publication is in the future');
  return true;
}

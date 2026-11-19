import { validateLeadProfile, isQualificationComplete } from './profile.mjs';
import { buildFaiscaPortalReadiness } from './portal-readiness.mjs';

export const NATIVE_ONEPAGE_INTENT_SCHEMA = 'faisca.portal-onepage-intent.preview.v1';
export const NATIVE_ONEPAGE_PORTAL_PIN = '0e0ccc06755b6ddd938635e5c4c3625ff6497e2c';

/**
 * Review-only adapter for the Portal's native Onepage contract (Portal #941).
 *
 * The authenticated Portal owns actor, organization, offer, tier selection,
 * pricing, contract, consent/acceptance, payment and order creation.
 * No request, URL, credentials or client authority are created in Faísca.
 */
export function buildNativeOnepagePortalIntent(profile) {
  const safe = validateLeadProfile(profile);
  if (!safe || !isQualificationComplete(safe)) return null;
  const readiness = buildFaiscaPortalReadiness(safe);
  // Do not derive an operational hint from a stale or expanded checkout gate.
  if (!readiness || readiness.readinessCode !== 'private_single_preview_only' ||
      readiness.publicCheckoutAuthorized !== false ||
      readiness.portalLoginOrRedirectAuthorized !== false ||
      readiness.finalServerRepricingRequired !== true) return null;

  const supported = safe.service === 'onepage';
  return Object.freeze({
    schema: NATIVE_ONEPAGE_INTENT_SCHEMA,
    portalContractPin: NATIVE_ONEPAGE_PORTAL_PIN,
    status: supported ? 'onepage_intent_only' : 'native_onepage_not_supported',
    service: safe.service,
    // Onepage-only, intentionally NOT a valid Portal createDraft request:
    // do not select tier, build a request_key, or infer identity in Faísca.
    offerHint: supported ? Object.freeze({ site: 'onepage' }) : null,
    needsAuthenticatedPortalSession: true,
    needsPortalTierChoice: supported,
    needsPortalQuoteAndTermsReview: supported,
    needsExplicitBuyerAcceptance: supported,
    publicCheckoutAuthorized: false,
    portalLoginOrRedirectAuthorized: false,
    requestCreated: false,
    leadSent: false,
    orderCreated: false,
    paymentRequested: false,
    productionStarted: false,
    operationalEffects: false
  });
}

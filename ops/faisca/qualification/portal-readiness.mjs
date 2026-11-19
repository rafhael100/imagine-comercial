import { validateLeadProfile, isQualificationComplete } from './profile.mjs';
import {
  assessPublicPortalReadiness, describePublicPortalReadiness
} from '../../../src/lib/public-portal-checkout-readiness.mjs';

export const FAISCA_PORTAL_READINESS_SCHEMA = 'faisca.portal-readiness.preview.v1';
const siteToCommercial = Object.freeze({
  onepage: 'onepage',
  'landing-page': 'landing-pages'
});

/**
 * Read the *same* public checkout availability rule as Imagine Comercial.
 * This is a display-only description of the current PRIVATE preview, not a
 * Portal request, link generator, payment or access grant.
 */
export function buildFaiscaPortalReadiness(profile) {
  const safe = validateLeadProfile(profile);
  if (!safe || !isQualificationComplete(safe)) return null;
  const site = siteToCommercial[safe.service];
  if (!site) return null;

  try {
    const selection = Object.freeze({ site, channels: Object.freeze([]), tier: 'minimum' });
    const result = assessPublicPortalReadiness(selection);
    // An unexpected policy expansion must not automatically enable an
    // operational capability in Faísca. Require a new reviewed contract.
    if (result.code !== 'private_single_preview_only' ||
        result.publicCheckoutAuthorized !== false ||
        result.automaticChargeAuthorized !== false ||
        result.portalLoginOrRedirectAuthorized !== false ||
        result.finalServerRepricingRequired !== true) return null;

    return Object.freeze({
      schema: FAISCA_PORTAL_READINESS_SCHEMA,
      source: 'imagine-comercial-f348',
      service: safe.service,
      readinessCode: result.code,
      text: describePublicPortalReadiness(selection, 'pt-BR'),
      privatePreviewOnly: true,
      publicCheckoutAuthorized: false,
      portalLoginOrRedirectAuthorized: false,
      orderCreated: false,
      paymentCreated: false,
      credentialsRequested: false,
      finalServerRepricingRequired: true,
      operationalEffects: false
    });
  } catch {
    // Catalog or policy conflict means no checkout claim, never a fallback
    // that guesses a price or reveals a Portal endpoint.
    return null;
  }
}

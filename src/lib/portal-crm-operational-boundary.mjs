/**
 * F94 — executable fail-closed boundary between the public Comercial site,
 * Portal intake service and CRM durable delivery.
 *
 * These are acceptance requirements, NOT claims that the remote repositories
 * are in production or have been independently verified.
 *
 * The existing labs F30/F78-F93 are NOT an authorization to start capture.
 * No consumer-supplied flag, synthetic receipt, CI success, signed fixture,
 * or GitHub PR can grant an operational capability through this module.
 */
const sourceSnapshot = 'CODE_REVIEW_SNAPSHOT_NOT_RUNTIME_VERIFICATION';
const requirements = [
  {
    id:'visitor-privacy-notice-and-lawful-basis',
    accountable:'Comercial+Legal',
    test:'Reviewed legal basis, privacy notice, minimization, and retention for each contact field',
    availableLab:'F82-F84_PRIVATE_FORM_VISUAL_ONLY'
  },
  {
    id:'browser-abuse-protection',
    accountable:'Portal+Security',
    test:'Private staging proves origin/rate limits, accessible bot defense, size limits and safe rejection',
    availableLab:'F76_PUBLIC_FORM_DISABLED'
  },
  {
    id:'portal-receiver-deployment',
    accountable:'Portal',
    test:'Versioned real HTTPS ingestion API hosted in private staging with an operator-owned rollback',
    availableLab:'NO_APPROVED_LEAD_RECEIVER_ENDPOINT'
  },
  {
    id:'service-identity-and-tenant-binding',
    accountable:'Portal+CRM+Security',
    test:'Trusted server-derived tenant, binding, site, form and destination; spoofing and revocation tests',
    availableLab:'F78_F80_UUID_STRUCTURE_ONLY'
  },
  {
    id:'consent-provenance-and-audit',
    accountable:'Portal+Legal',
    test:'Durable purpose/version/timestamp/source evidence and withdrawal/retention policy, no raw PII in logs',
    availableLab:'F30_F77_SYNTHETIC_CONSENT_ONLY'
  },
  {
    id:'atomic-lead-reservation',
    accountable:'CRM+DBA',
    test:'Persistent database and tenant-scoped unique reservation, concurrency and recovery across processes',
    availableLab:'F85_EPHEMERAL_POSTGRES_ONLY'
  },
  {
    id:'transactional-outbox-and-worker',
    accountable:'Portal+CRM',
    test:'Real transaction, scoped worker permissions, throttling, retries, alerting and crash recovery',
    availableLab:'F86_F89_EPHEMERAL_POSTGRES_ONLY'
  },
  {
    id:'replay-and-key-management',
    accountable:'Portal+CRM+Security',
    test:'Real server credentials, payload integrity, key rotation/revocation and durable nonce scope',
    availableLab:'F90_F91_SYNTHETIC_HMAC_AND_NONCE_ONLY'
  },
  {
    id:'remote-crm-ack-and-consistency',
    accountable:'CRM+DBA',
    test:'Destination-authenticated durable record lookup, pinned context, idempotent ACK and mismatch handling',
    availableLab:'F93_RECEIVER_CLAIMS_UNTRUSTED'
  },
  {
    id:'unknown-outcome-reconciliation',
    accountable:'Portal+CRM+Operations',
    test:'Timeout/late ACK/partition drills reconcile independent stores before retry or deletion',
    availableLab:'F92_F93_NO_REMOTE_PROOF'
  },
  {
    id:'operational-privacy-and-retention',
    accountable:'Portal+CRM+Legal',
    test:'Approved 3+15 day retry, purge, 90-day technical audit, backup/restore and data subject requests',
    availableLab:'F3_08_CRM_RETENTION_LAB_ONLY'
  },
  {
    id:'legacy-budget-form-parity',
    accountable:'Comercial+Product',
    test:'Actual quote intake and confirmations match reviewed legacy behavior, including role/mobile policy',
    availableLab:'F83_F84_VISUAL_6_OF_7_ONLY'
  },
  {
    id:'independent-security-review',
    accountable:'Independent SEG+DBA',
    test:'Independent authenticated access, RLS, abuse, storage and penetration review signed for staging',
    availableLab:'CI_IS_NOT_INDEPENDENT_REVIEW'
  },
  {
    id:'release-owner-explicit-approval',
    accountable:'Release Owner',
    test:'Human release authorization after staging evidence, rollback, DNS and operator readiness',
    availableLab:'NO_DEPLOY_AUTHORIZATION'
  }
];

export const PORTAL_CRM_OPERATIONAL_ACCEPTANCE = Object.freeze(
  requirements.map(item=>Object.freeze({...item}))
);

/**
 * Intentionally zero-input: a boolean or JSON supplied by a caller cannot
 * turn a draft PR or a lab diagnostic into proof of operational readiness.
 */
export function reviewPortalCrmOperationalBoundary(){
  return Object.freeze({
    schema:'imagine.comercial.portal-crm-operational-boundary.v1',
    evidenceClass:sourceSnapshot,
    state:'BLOCKED_NO_INDEPENDENT_OPERATIONAL_EVIDENCE',
    requiredCount:PORTAL_CRM_OPERATIONAL_ACCEPTANCE.length,
    independentlyVerifiedCount:0,
    unresolved:Object.freeze(PORTAL_CRM_OPERATIONAL_ACCEPTANCE.map(x=>x.id)),
    requirements:PORTAL_CRM_OPERATIONAL_ACCEPTANCE,
    canCollectPublicLeads:false,
    canTrustTenantClaims:false,
    canClaimDurableCrmReceipt:false,
    canAutoRetryUnknownOutcome:false,
    canReplaceLegacyContactForm:false,
    canDeploy:false,
    deploymentPerformed:false
  });
}

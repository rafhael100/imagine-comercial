/**
 * F301 — six required independent, PRIVATE Leaseweb staging observations.
 * This is a SOURCE-LEVEL runbook inventory, not a live remote probe.
 * Code/CI existence never advances verifiedCount or permits deployment.
 */
export const PRIVATE_STAGING_REVIEW_STAGES=Object.freeze([
  Object.freeze({
    id:'source-and-package',script:'scripts/check-private-staging-prerequisites.mjs',
    requirement:'Reviewed source configuration, independent SHA-256 tree pin and private bcrypt credential'
  }),
  Object.freeze({
    id:'running-container',script:'scripts/inspect-running-private-staging.mjs',
    requirement:'Authorized running Docker container, loopback-only port, readonly mounts and no elevated privileges'
  }),
  Object.freeze({
    id:'active-nginx',script:'scripts/check-running-private-nginx.mjs',
    requirement:'Actual loaded Nginx configuration matches the version-controlled reviewed source'
  }),
  Object.freeze({
    id:'full-http',script:'scripts/review-private-staging-operator.mjs',
    requirement:'Full private HTML/asset byte parity, auth challenges and 27 legacy 404 routes'
  }),
  Object.freeze({
    id:'http-methods',script:'scripts/check-private-staging-methods.mjs',
    requirement:'Real private HEAD 401/200/404 and POST/PUT/DELETE/OPTIONS denied'
  }),
  Object.freeze({
    id:'reserved-paths',script:'scripts/check-private-staging-reserved-routes.mjs',
    requirement:'Sensitive internal paths denied with pinned 404 body even when authenticated'
  })
]);

export function reportUnverifiedPrivateStaging(){
  return Object.freeze({
    schema:'imagine.comercial.private-staging-prerequisite-report.v1',
    source:'STATIC_RUNBOOK_ONLY_NOT_LEASEWEB_EVIDENCE',
    status:'BLOCKED_EXTERNAL_PRIVATE_STAGING_NOT_ATTESTED',
    requiredStages:PRIVATE_STAGING_REVIEW_STAGES.length,
    independentlyVerifiedStages:0,
    unresolvedStages:Object.freeze(PRIVATE_STAGING_REVIEW_STAGES.map(item=>item.id)),
    stages:PRIVATE_STAGING_REVIEW_STAGES,
    canClaimStagingRuntimeObserved:false,
    remoteTlsFirewallAndSshVerified:false,
    independentShaAndImageProvenanceVerified:false,
    portalCrmLiveDeliveryVerified:false,
    appsecDbaLgpdApproved:false,
    canCollectPublicLeads:false,
    productionAuthorized:false,
    deploymentPerformed:false
  });
}

/**
 * F258 — consolidate four independent, read-only PRIVATE staging diagnostics.
 * Never interpret successful tests as release authority or as independent
 * confirmation of Leaseweb network/TLS, owner approval or live Portal→CRM.
 */
const HOLD='F258: private staging diagnostic chain incomplete (HOLD)';
const yes=v=>{if(!v)throw Error(HOLD);};
export function evaluateReadOnlyPrivateStagingChain({
  preflight,container,nginx,http
}={}){
  yes(preflight?.config?.status==='REVIEWED_SOURCE_CONFIG_MATCH_ONLY'&&
    preflight?.buildIntegrity?.exactTreeBytesVerified===true&&
    preflight?.authFile?.filePermissionsPrivate===true&&
    preflight?.immutableDigestSyntax===true&&
    preflight?.deploymentAuthorized===false&&
    preflight?.deploymentPerformed===false);
  yes(container?.status==='RUNNING_CONTAINER_INSPECT_FIELDS_MATCH_REVIEW_ONLY'&&
    container?.actualLoopbackPortBindingReported===true&&
    container?.threeReadonlyMountsReported===true&&
    container?.constrainedDockerPrivilegesReported===true&&
    container?.productionAuthorized===false&&
    container?.deploymentPerformed===false);
  yes(nginx?.status==='LOADED_NGINX_CONFIG_EQUALS_REVIEWED_SOURCE_ONLY'&&
    nginx?.expectedStaticConfigLoaded===true&&
    nginx?.unapprovedAdditionalConfigFileAbsent===true&&
    nginx?.duplicateServerBlockAbsent===true&&
    nginx?.deployAuthorized===false&&nginx?.deployedByThisCheck===false);
  yes(http?.status==='PRIVATE_CANDIDATE_REVIEWED_STILL_NO_RELEASE_AUTHORITY'&&
    http?.checks?.coverageProfile==='COMPLETE_PRIVATE_CATALOG_AND_LEGACY'&&
    http?.checks?.servedHtmlMatchesLocalPinnedBuild===true&&
    http?.checks?.servedStaticAssetsMatchPinnedBuild===true&&
    http?.checks?.buildTreeBytesStableAfterHttp===true&&
    http?.checks?.unauthenticatedHomepageDenied===true&&
    http?.canCollectPublicLeads===false&&
    http?.deploymentAuthorized===false&&
    http?.deploymentPerformed===false);
  return Object.freeze({
    schema:'imagine.comercial.private-staging-diagnostic-chain.v1',
    status:'PRIVATE_DIAGNOSTIC_CHAIN_PASSED_NOT_RELEASE_APPROVAL',
    validatedGates:4,
    localSourceAndBuildPreflightPassed:true,
    runningContainerInspectPassed:true,
    loadedNginxConfigPassed:true,
    completePrivateHttpByteParityPassed:true,
    externalTlsAndFirewallIndependentlyVerified:false,
    imageOriginAndLiveDigestIndependentlyVerified:false,
    portalCrmDurableDeliveryVerified:false,
    applicationSecurityAndPrivacyApprovalPresent:false,
    legacyRedirectsApproved:false,
    launchOwnerApproved:false,
    canCollectPublicLeads:false,
    deploymentAuthorized:false,
    deploymentPerformed:false
  });
}

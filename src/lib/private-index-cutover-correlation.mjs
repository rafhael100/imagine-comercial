/**
 * F283 — Cross-check PRIVATE, normalized GSC inspection with the operator's
 * legacy route continuity plan. Pure, no data writes, URL echoes or network.
 * Both sources are untrusted assertions. This NEVER approves a release.
 */
import {legacyUrls} from '../data/legacy-urls.mjs';
import {parseObservedPage} from './gsc-inventory-review.mjs';
import {reviewIndexedLegacyHoldExposure}
  from './legacy-index-preservation-review.mjs';
import {reviewLegacyCutoverCoverage} from './legacy-cutover-coverage.mjs';

const known=new Map(legacyUrls.map(x=>[x.from,x.status]));

export function crossReviewIndexedCutover({inspections,decisions}={}){
  // First validate both entire data sets using the independent contracts.
  // Do not touch individual properties on unvalidated inputs.
  const observed=reviewIndexedLegacyHoldExposure({inspections});
  const planned=reviewLegacyCutoverCoverage(decisions);
  const decisionMap=new Map(decisions.map(item=>[item.from,item.plan]));
  const held=new Set(),candidates=new Set(),unmapped=new Set();
  for(const item of inspections){
    if(item.verdict!=='PASS')continue;
    const route=parseObservedPage(item.url);
    if(route.hasQuery||route.unusualPath||route.httpSource||route.from==='/')continue;
    const state=known.get(route.from);
    if(state==='hold')held.add(route.from);
    else if(state==='candidate')candidates.add(route.from);
    else if(state===undefined)unmapped.add(route.from);
  }
  const heldRetained=[...held].filter(x=>decisionMap.get(x)==='retain-original').length;
  const candidatesReviewed=[...candidates].filter(x=>
    decisionMap.get(x)==='review-redirect'||decisionMap.get(x)==='retain-original').length;
  return Object.freeze({
    schema:'imagine.comercial.private-index-cutover-correlation.v1',
    mode:'TWO_UNTRUSTED_PRIVATE_INPUTS_NO_REDIRECT_AUTHORITY',
    inspectedUrlVariants:observed.inspectedUrlVariants,
    indexedHeldPaths:held.size,
    indexedHeldWithRetainAssertion:heldRetained,
    indexedHeldMissingRetainAssertion:held.size-heldRetained,
    indexedCandidates:candidates.size,
    indexedCandidatesWithExplicitReviewDecision:candidatesReviewed,
    indexedCandidatesWithoutDecision:candidates.size-candidatesReviewed,
    indexedPathsOutsideInventory:unmapped.size,
    unresolvedProtocolOrQueryVariants:observed.protocolOrQueryVariantsHeld,
    otherUnresolvedVerdicts:observed.otherVerdictsUnresolved,
    inventoryMissingDecisions:planned.missingDecisions,
    inventoryPendingDecisions:planned.pendingDecisions,
    allKnownRoutesPlanned:planned.completePlanningCoverage,
    status:'NO_GO_LIVE_PRESERVATION_NOT_VERIFIED',
    googleOriginAndCompletenessVerified:false,
    originalLegacyHttpPreservationVerified:false,
    editorialLegalAndSeoApproved:false,
    publicRedirectionsAuthorized:0,
    canDecommissionLegacySite:false,
    productionAuthorized:false,
    deploymentPerformed:false,
    privateUrlsOrMetricsWritten:false
  });
}

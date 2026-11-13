/**
 * F277 — fail-closed release planning for ALL known legacy routes.
 * This is not a redirect generator or proof of live legacy preservation.
 * An operator's assertion cannot authorize decommission, deploy, or 301.
 */
import {legacyUrls} from '../data/legacy-urls.mjs';

const inventory=new Map(legacyUrls.map(item=>[item.from,item]));
const allowed=new Set(['retain-original','review-redirect','pending']);
function exactData(value){
  if(value===null||typeof value!=='object'||Array.isArray(value)||
     Object.getPrototypeOf(value)!==Object.prototype)return false;
  const keys=Reflect.ownKeys(value);
  if(keys.length!==2||keys.some(k=>typeof k!=='string'||!['from','plan'].includes(k)))
    return false;
  return keys.every(key=>{
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    return descriptor?.enumerable===true&&Object.hasOwn(descriptor,'value');
  });
}

export function reviewLegacyCutoverCoverage(decisions=[]){
  if(!Array.isArray(decisions)||decisions.length>inventory.size||
     Object.getPrototypeOf(decisions)!==Array.prototype)
    throw Error('F277: invalid legacy cutover decisions');
  const assigned=new Map();
  for(const decision of decisions){
    if(!exactData(decision)||typeof decision.from!=='string'||
       !inventory.has(decision.from)||!allowed.has(decision.plan)||
       assigned.has(decision.from))
      throw Error('F277: unknown, duplicate or unsafe legacy decision');
    if(decision.plan==='review-redirect'&&
       inventory.get(decision.from).status!=='candidate')
      throw Error('F277: HOLD legacy route cannot become redirect candidate');
    assigned.set(decision.from,decision.plan);
  }
  const held=legacyUrls.filter(x=>x.status==='hold');
  const candidates=legacyUrls.filter(x=>x.status==='candidate');
  const retain=legacyUrls.filter(x=>assigned.get(x.from)==='retain-original');
  const reviewedCandidates=candidates.filter(x=>assigned.get(x.from)==='review-redirect');
  const missing=legacyUrls.filter(x=>!assigned.has(x.from));
  const stillPending=legacyUrls.filter(x=>assigned.get(x.from)==='pending');
  return Object.freeze({
    schema:'imagine.comercial.legacy-cutover-coverage.v1',
    status:'NO_GO_LEGACY_CONTINUITY_NOT_OPERATIONALLY_VERIFIED',
    knownLegacyRoutes:legacyUrls.length,
    heldLegacyRoutes:held.length,
    candidateLegacyRoutes:candidates.length,
    operatorAssertedRetainCount:retain.length,
    candidateRedirectsOnlyForReview:reviewedCandidates.length,
    missingDecisions:missing.length,
    pendingDecisions:stillPending.length,
    heldRoutesWithoutRetainAssertion:held.filter(x=>assigned.get(x.from)!=='retain-original').length,
    completePlanningCoverage:missing.length===0&&stillPending.length===0,
    originalLegacyContentLiveHttpVerified:false,
    editorialAndLegalEquivalenceApproved:false,
    indexedGscCoverageIndependentlyVerified:false,
    redirectsAuthorized:0,
    canReplaceLegacySite:false,
    dnsChangeAuthorized:false,
    productionAuthorized:false,
    deploymentPerformed:false
  });
}

/**
 * F276 — PRIVATE, metric-free inspection risk review for the legacy domain.
 * Input is a manually normalized, untrusted GSC URL Inspection sample.
 * This does not authenticate Google, prove complete coverage or authorize
 * redirects, deleting legacy pages, DNS, public intake or deployment.
 */
import {legacyUrls} from '../data/legacy-urls.mjs';
import {parseObservedPage} from './gsc-inventory-review.mjs';

const verdicts=new Set(['PASS','NEUTRAL','FAIL','VERDICT_UNSPECIFIED']);
const exact=(v,fields)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
  Object.getPrototypeOf(v)===Object.prototype&&
  Reflect.ownKeys(v).length===fields.length&&
  Reflect.ownKeys(v).every(k=>typeof k==='string'&&fields.includes(k)&&
    Object.getOwnPropertyDescriptor(v,k)?.enumerable===true&&
    Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));

export function reviewIndexedLegacyHoldExposure({inspections}={}){
  if(!Array.isArray(inspections)||inspections.length<1||inspections.length>100)
    throw Error('F276: invalid private inspection batch');
  const known=new Map(legacyUrls.map(x=>[x.from,x.status]));
  const seen=new Set(),held=new Set(),candidates=new Set(),unmapped=new Set();
  let protocolOrQueryVariants=0,unresolvedVerdicts=0,indexedOldHostRoots=0;
  for(const row of inspections){
    if(!exact(row,['url','verdict'])||typeof row.url!=='string'||
       row.url.length>4096||!verdicts.has(row.verdict))
      throw Error('F276: invalid private inspection row');
    let parsed;
    try{parsed=parseObservedPage(row.url);}
    catch{throw Error('F276: invalid private inspection row');}
    const key=[parsed.host,parsed.from,parsed.httpSource,parsed.hasQuery,
      parsed.unusualPath].join('\0');
    if(seen.has(key))throw Error('F276: ambiguous or duplicated inspection');
    seen.add(key);
    if(parsed.httpSource||parsed.hasQuery||parsed.unusualPath){
      protocolOrQueryVariants++;
      continue;
    }
    if(row.verdict!=='PASS'){
      unresolvedVerdicts++;
      continue;
    }
    if(parsed.from==='/'){
      indexedOldHostRoots++;
      continue;
    }
    const status=known.get(parsed.from);
    if(status==='hold')held.add(parsed.from);
    else if(status==='candidate')candidates.add(parsed.from);
    else if(status===undefined)unmapped.add(parsed.from);
  }
  const risk=held.size>0||unmapped.size>0;
  return Object.freeze({
    schema:'imagine.comercial.private-gsc-index-hold-review.v1',
    mode:'UNTRUSTED_PRIVATE_GSC_SAMPLE_REVIEW_ONLY',
    status:risk?'INDEXED_LEGACY_PAGES_REQUIRE_PRESERVATION_REVIEW':
      'PARTIAL_EVIDENCE_NOT_RELEASE_AUTHORITY',
    inspectedUrlVariants:inspections.length,
    indexedHeldLegacyPaths:held.size,
    indexedCandidateLegacyPaths:candidates.size,
    indexedUnmappedLegacyPaths:unmapped.size,
    indexedRootHostVariants:indexedOldHostRoots,
    protocolOrQueryVariantsHeld:protocolOrQueryVariants,
    otherVerdictsUnresolved:unresolvedVerdicts,
    sourceCoverageComplete:false,
    editorialEquivalenceApproved:false,
    legalAndPrivacyReviewApproved:false,
    redirectsApproved:0,
    canRemoveHeldLegacyPages:false,
    canonicalHostMigrationApproved:false,
    productionAuthorized:false,
    deploymentPerformed:false,
    privateUrlsOrMetricsPersisted:false
  });
}

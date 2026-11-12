/**
 * F227: exact offline route/host staging checklist and fail-closed review.
 * No network, no production redirects, no DNS, no release authority.
 * Legacy candidate paths are also HOLD until URL-by-URL human approval.
 */
import {sitePages} from '../data/services.mjs';
import {legacyUrls} from '../data/legacy-urls.mjs';
import {CANONICAL_ORIGIN,getCanonicalHostPolicy} from './canonical-host-policy.mjs';

const origins=getCanonicalHostPolicy().variants;
const indexed=new Set(sitePages.map(x=>x.path));
const historical=new Set(legacyUrls.map(x=>x.from));
if(indexed.size!==sitePages.length||historical.size!==legacyUrls.length)
  throw Error('F227: duplicate inventory route');
for(const path of historical)if(indexed.has(path))throw Error('F227: legacy/current collision');

const key=(origin,path)=>origin+'\u0000'+path;
const own=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  [Object.prototype,null].includes(Object.getPrototypeOf(x))&&
  Reflect.ownKeys(x).length===keys.length&&
  keys.every(k=>Object.hasOwn(x,k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(x,k),'value'));
const fields=['origin','path','status','location','tlsValid','noindex'];

export function buildStagingHostRouteChecklist(){
  const items=[];
  for(const origin of origins){
    const https=origin.startsWith('https://');
    for(const path of sitePages.map(x=>x.path)){
      const canonical=origin===CANONICAL_ORIGIN;
      items.push(Object.freeze({
        origin,path,category:canonical?'CURRENT_CANONICAL':'CURRENT_HOST_CANDIDATE',
        expectedStatus:canonical?200:301,
        expectedLocation:canonical?null:CANONICAL_ORIGIN+path,
        expectedNoindex:canonical?false:null,
        expectedTlsValid:https?true:null
      }));
    }
    for(const item of legacyUrls){
      items.push(Object.freeze({
        origin,path:item.from,
        category:item.status==='candidate'?'LEGACY_CANDIDATE_HOLD':'LEGACY_HOLD',
        expectedStatus:404,expectedLocation:null,expectedNoindex:true,
        expectedTlsValid:https?true:null
      }));
    }
  }
  return Object.freeze(items);
}

export function reviewStagingHostRouteObservations(rows){
  const expected=buildStagingHostRouteChecklist();
  if(!Array.isArray(rows)||rows.length!==expected.length)
    throw TypeError('F227: full four-host route inventory required');
  const byKey=new Map(expected.map(x=>[key(x.origin,x.path),x]));
  const seen=new Set(),failures=[];
  for(const row of rows){
    if(!own(row,fields)||typeof row.origin!=='string'||typeof row.path!=='string'||
       !Number.isInteger(row.status)||row.status<100||row.status>599||
       !(row.location===null||(typeof row.location==='string'&&row.location.length<=2048))||
       !(row.tlsValid===null||typeof row.tlsValid==='boolean')||
       !(row.noindex===null||typeof row.noindex==='boolean'))
      throw TypeError('F227: malformed route evidence');
    const id=key(row.origin,row.path),contract=byKey.get(id);
    if(!contract||seen.has(id))throw TypeError('F227: unexpected or duplicate host/path');
    seen.add(id);
    const passed=row.status===contract.expectedStatus&&
      row.location===contract.expectedLocation&&
      row.tlsValid===contract.expectedTlsValid&&
      row.noindex===contract.expectedNoindex;
    if(!passed)failures.push(Object.freeze({
      origin:contract.origin,path:contract.path,category:contract.category,
      result:'STAGING_POLICY_MISMATCH'
    }));
  }
  if(seen.size!==expected.length)throw TypeError('F227: incomplete route evidence');
  return Object.freeze({
    contractVersion:'imagine.comercial.host-route-staging-review.v1',
    source:'OPERATOR_SUPPLIED_UNVERIFIED_OFFLINE_EVIDENCE',
    checklistItems:expected.length,
    publicRoutes:indexed.size,
    legacyCandidates:legacyUrls.filter(x=>x.status==='candidate').length,
    legacyHeld:legacyUrls.filter(x=>x.status==='hold').length,
    passed:failures.length===0,
    failures:Object.freeze(failures),
    redirectsAuthorized:0,
    productionAuthorized:false,
    dnsChangeAuthorized:false,
    warning:'Private staging contract only; not real network proof, migration mapping, redirect authorization or release.'
  });
}

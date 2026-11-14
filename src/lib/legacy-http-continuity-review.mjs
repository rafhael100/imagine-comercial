/**
 * F-LEGACY-HTTP — compare two operator-observed snapshots for every known
 * old URL before an irreversible production cutover.
 *
 * Snapshots are NOT trusted provenance. Byte-for-byte comparisons can find
 * regressions but cannot authorize a redirect, DNS change or production
 * release. Dynamic old pages may differ legitimately; such cases require an
 * independent human/legal review instead of a bypass.
 *
 * No network, no dynamic URL construction, no customer input, no writes.
 */
import {legacyUrls} from '../data/legacy-urls.mjs';

const byPath=new Map(legacyUrls.map(item=>[item.from,item]));
const HASH=/^[0-9a-f]{64}$/;
const SCHEMA='imagine.comercial.legacy-http-snapshot.v1';
const mandatoryFields=['path','status','mime','bodySha256','bytes','redirectTo'];
const arrayOk=(v,length)=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&
 v.length===length&&Reflect.ownKeys(v).length===length+1&&
 Array.from({length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i)))
   .every(d=>d?.enumerable===true&&Object.hasOwn(d,'value'));
const recordOk=(v,fields)=>v!==null&&typeof v==='object'&&
 !Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&
 Reflect.ownKeys(v).length===fields.length&&fields.every(k=>{
  const d=Object.getOwnPropertyDescriptor(v,k);
  return d?.enumerable===true&&Object.hasOwn(d,'value');
 });

function validateSnapshot(snapshot,role){
 if(!recordOk(snapshot,['schema','scope','rows'])||
    snapshot.schema!==SCHEMA||snapshot.scope!==role||
    !arrayOk(snapshot.rows,legacyUrls.length))
    throw Error('F-LEGACY-HTTP: missing or malformed complete HTTP evidence');
 const evidence=new Map();
 for(const row of snapshot.rows){
  if(!recordOk(row,mandatoryFields)||typeof row.path!=='string'||
    !byPath.has(row.path)||evidence.has(row.path)||
    !Number.isInteger(row.status)||row.status<200||row.status>599||
    !Number.isSafeInteger(row.bytes)||row.bytes<0||row.bytes>1024*1024)
    throw Error('F-LEGACY-HTTP: invalid, unknown or duplicate observed route');
  if(row.status===200){
   if(row.mime!=='text/html'||typeof row.bodySha256!=='string'||
      !HASH.test(row.bodySha256)||new Set(row.bodySha256).size===1||
      row.bytes===0||row.redirectTo!==null)
     throw Error('F-LEGACY-HTTP: invalid HTML evidence');
  }else if(row.status===301||row.status===302||row.status===307||row.status===308){
   if(row.mime!==null||row.bodySha256!==null||row.bytes!==0||
     (row.redirectTo!==null&&
       (typeof row.redirectTo!=='string'||!/^\/(?:[a-z0-9-]+\/)*$/.test(row.redirectTo))))
     throw Error('F-LEGACY-HTTP: unreviewed redirect evidence');
  }else if(row.mime!==null||row.bodySha256!==null||
     row.bytes!==0||row.redirectTo!==null)
    throw Error('F-LEGACY-HTTP: HTTP failure cannot include trusted page bytes');
  evidence.set(row.path,row);
 }
 if(evidence.size!==byPath.size)
  throw Error('F-LEGACY-HTTP: incomplete known legacy inventory');
 return evidence;
}

export function reviewLegacyHttpContinuity(before,after){
 const old=validateSnapshot(before,'BEFORE_ORIGINAL');
 const candidate=validateSnapshot(after,'AFTER_CANDIDATE');
 let heldOriginallyHtml=0,heldPreservedExact=0,heldMissingOrChanged=0;
 let heldOriginalStatusUnproven=0,candidatesOriginallyHtml=0;
 let candidatesPreservedExact=0,candidateRedirectsStillUnauthorized=0;
 let candidateMissingOrChanged=0,candidateOriginalStatusUnproven=0;
 for(const entry of legacyUrls){
  const a=old.get(entry.from),b=candidate.get(entry.from);
  if(entry.status==='hold'){
   if(a.status!==200){
    heldOriginalStatusUnproven++;
   }else{
    heldOriginallyHtml++;
    if(b.status===200&&b.bodySha256===a.bodySha256&&b.bytes===a.bytes)
      heldPreservedExact++;
    else heldMissingOrChanged++;
   }
  }else if(entry.status==='candidate'){
   if(a.status!==200){
    candidateOriginalStatusUnproven++;
   }else{
    candidatesOriginallyHtml++;
    if(b.status===200&&b.bodySha256===a.bodySha256&&b.bytes===a.bytes)
      candidatesPreservedExact++;
    else if(b.status===301&&b.redirectTo===entry.to)
      candidateRedirectsStillUnauthorized++;
    else candidateMissingOrChanged++;
   }
  }else throw Error('F-LEGACY-HTTP: unknown migration state');
 }
 const allHeldBytePreserved=heldOriginallyHtml===22&&
   heldPreservedExact===22&&heldMissingOrChanged===0;
 return Object.freeze({
  schema:'imagine.comercial.legacy-http-continuity-review.v1',
  status:'NO_GO_OPERATOR_HTTP_EVIDENCE_REVIEW_ONLY',
  knownLegacyPaths:legacyUrls.length,
  heldPaths:22,candidatePaths:5,
  heldOriginallyHtml,heldPreservedExact,heldMissingOrChanged,
  heldOriginalStatusUnproven,
  candidatesOriginallyHtml,candidatesPreservedExact,
  candidateRedirectsStillUnauthorized,candidateMissingOrChanged,
  candidateOriginalStatusUnproven,
  allHeldBytePreserved,
  allObservedVersionsAuthentic:false,
  externalTlsOrDnsProven:false,
  sourceSnapshotTrustedIndependently:false,
  editorialAndLegalApproval:false,
  observed301IsAuthorization:false,
  newSiteCanReplaceOriginal:false,
  redirectsAuthorized:0,
  actualDeploymentPerformed:false,
  noCustomerOrPageContentLogged:true
 });
}

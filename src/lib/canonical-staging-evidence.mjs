/**
 * F226: offline review of operator-supplied synthetic host-root HTTP observations.
 * Never connects to a network, produces a redirect file or grants release approval.
 */
import {CANONICAL_ORIGIN,getCanonicalHostPolicy} from './canonical-host-policy.mjs';

const expected=getCanonicalHostPolicy().variants;
const own=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null)&&
  Reflect.ownKeys(x).length===keys.length&&
  keys.every(k=>Object.hasOwn(x,k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(x,k),'value'));
const rowKeys=['origin','status','location','tlsValid'];
export function reviewCanonicalStagingEvidence(rows){
  if(!Array.isArray(rows)||rows.length!==4)
    throw new TypeError('F226: exactly four origin observations required');
  const seen=new Set(),findings=[];
  for(const row of rows){
    if(!own(row,rowKeys)||!expected.includes(row.origin)||seen.has(row.origin)||
      !Number.isInteger(row.status)||row.status<100||row.status>599||
      !(row.location===null||typeof row.location==='string')||
      !(row.tlsValid===null||typeof row.tlsValid==='boolean'))
      throw new TypeError('F226: invalid or duplicate observation');
    seen.add(row.origin);
    const canonical=row.origin===CANONICAL_ORIGIN;
    const https=row.origin.startsWith('https://');
    // Root-path only. URLs with query, path, credentials, ports and chains must
    // never be normalized by this report into an approved redirect.
    const validTls=https?row.tlsValid===true:row.tlsValid===null;
    const validHttp=canonical?
      (row.status===200&&row.location===null):
      (row.status===301&&row.location===CANONICAL_ORIGIN+'/');
    findings.push(Object.freeze({
      variant:canonical?'CANONICAL_ROOT':'HOST_REDIRECT_CANDIDATE',
      origin:row.origin,
      passed:validTls&&validHttp,
      reason:!validTls?'TLS_EVIDENCE_FAILED':!validHttp?'HTTP_POLICY_MISMATCH':'ROOT_ONLY_CONTRACT_MATCH'
    }));
  }
  if(seen.size!==expected.length)throw new TypeError('F226: incomplete origin coverage');
  findings.sort((a,b)=>expected.indexOf(a.origin)-expected.indexOf(b.origin));
  return Object.freeze({
    contractVersion:'imagine.comercial.staging-host-evidence.v1',
    source:'UNVERIFIED_OPERATOR_SUPPLIED_OFFLINE_OBSERVATIONS',
    reviewPassed:findings.every(x=>x.passed),
    findings:Object.freeze(findings),
    scope:'ROOT_PATH_ONLY_NOT_LEGACY_MIGRATION',
    productionAuthorized:false,
    redirectRulesAuthorized:0,
    dnsChangeAuthorized:false,
    warning:'Offline observations cannot prove live staging, DNS, Search Console, full TLS or safe URL migration.'
  });
}

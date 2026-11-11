/**
 * Host migration review only: compare www property evidence with the new
 * non-www canonical origin. This NEVER emits 301 rules or deploys.
 */
import {sitePages} from '../data/services.mjs';
import {legacyUrls} from '../data/legacy-urls.mjs';

const CURRENT=new Set(sitePages.map(x=>x.path));
const LEGACY=new Set(legacyUrls.map(x=>x.from));
const HOSTS=new Set(['imaginecomunicacao.com.br','www.imaginecomunicacao.com.br']);
const PATH=/^\/[A-Za-z0-9._~%/-]*$/;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  [Object.prototype,null].includes(Object.getPrototypeOf(x));
const fields=(x,allowed)=>plain(x)&&Reflect.ownKeys(x).every(k=>
  typeof k==='string'&&allowed.has(k)&&
  Object.hasOwn(Object.getOwnPropertyDescriptor(x,k),'value'));
const INPUT_ROW=new Set(['host','path','state','proposedTarget',
  'queryOrFragmentSuppressed','clicks','impressions','averagePosition']);

export function reviewCanonicalHostMigration(evidence){
  if(!fields(evidence,new Set([
    'contractVersion','sourceType','status','summary','rows',
    'approvedRedirects','googleOriginVerified',
    'customerDataPublicationAuthorized','productionRedirectsAuthorized',
    'limitations'
  ]))||evidence.contractVersion!=='imagine.comercial.gsc-api-page-review.v1'||
    evidence.status!=='REVIEW_ONLY_NO_REDIRECTS_APPROVED'||
    evidence.sourceType!=='operator_supplied_api_shaped_pages_not_verified'||
    evidence.approvedRedirects!==0||evidence.googleOriginVerified!==false||
    evidence.productionRedirectsAuthorized!==false||
    evidence.customerDataPublicationAuthorized!==false||
    !Array.isArray(evidence.rows)||evidence.rows.length>1000)
    throw Error('canonical host review: offline GSC evidence required');

  const seen=new Set(),actions=[];
  for(const row of evidence.rows){
    if(!fields(row,INPUT_ROW)||Reflect.ownKeys(row).length!==INPUT_ROW.size||
      typeof row.host!=='string'||!HOSTS.has(row.host)||
      typeof row.path!=='string'||row.path.length>1024||
      !PATH.test(row.path)||row.path.includes('//')||
      row.path.split('/').some(s=>s==='.'||s==='..')||
      typeof row.queryOrFragmentSuppressed!=='boolean'||
      !Number.isSafeInteger(row.clicks)||row.clicks<0||
      !Number.isSafeInteger(row.impressions)||row.impressions<0||
      row.clicks>row.impressions)
      throw Error('canonical host review: malformed page evidence');
    const id=row.host+'\0'+row.path;
    if(seen.has(id))
      throw Error('canonical host review: duplicate host/path evidence');
    seen.add(id);
    let status='UNKNOWN_HOLD';
    let proposedCanonical=null;
    if(row.queryOrFragmentSuppressed||row.path.includes('%')){
      status='VARIANT_HOLD';
    }else if(CURRENT.has(row.path)){
      if(row.host==='www.imaginecomunicacao.com.br'){
        status='HOST_ONLY_CANDIDATE_NOT_APPROVED';
        proposedCanonical='https://imaginecomunicacao.com.br'+row.path;
      }else status='CURRENT_CANONICAL';
    }else if(LEGACY.has(row.path)){
      status='LEGACY_REVIEW_REQUIRED';
    }
    actions.push({host:row.host,path:row.path,status,proposedCanonical});
  }
  actions.sort((a,b)=>a.path.localeCompare(b.path)||a.host.localeCompare(b.host));
  return {
    contractVersion:'imagine.comercial.host-canonical-review.v1',
    sourceType:'unverified_offline_evidence_only',
    candidateHostOnly:actions.filter(x=>x.status==='HOST_ONLY_CANDIDATE_NOT_APPROVED').length,
    legacyHeld:actions.filter(x=>x.status==='LEGACY_REVIEW_REQUIRED').length,
    variantHeld:actions.filter(x=>x.status==='VARIANT_HOLD').length,
    unknownHeld:actions.filter(x=>x.status==='UNKNOWN_HOLD').length,
    actions,
    approvedRedirects:0,
    productionRedirectsAuthorized:false,
    canonicalHostChangeAuthorized:false,
    status:'HOLD_EDITORIAL_INFRA_SECURITY_REVIEW',
    warning:'No DNS, _redirects, Worker rules or production HTTP changes were made.'
  };
}

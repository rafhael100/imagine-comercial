/**
 * SEO-GSC page evidence: local-only review of API-shaped Search Console
 * pages (e.g. supplied by an authorized operator).
 * Reuses the existing legacy URL inventory. Never authorizes 301s or deploys.
 */
import {parseObservedPage,reviewGscPagesCsv} from './gsc-inventory-review.mjs';

const REPLY=new Set(['rows','responseAggregationType','metadata']);
const FIELDS=new Set(['keys','clicks','impressions','ctr','position']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  [Object.prototype,null].includes(Object.getPrototypeOf(value));
const allowed=(value,keys,exact=false)=>{
  if(!plain(value))return false;
  const found=Reflect.ownKeys(value);
  return (!exact||found.length===keys.size)&&found.every(k=>
    typeof k==='string'&&keys.has(k)&&
    Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value'));
};
const classifyKey=value=>[
  value.host,value.from,value.hasQuery,value.unusualPath
].join('\0');

export function reviewGscApiPageEvidence(response,{rowLimit=1000}={}){
  if(!allowed(response,REPLY)||!Object.hasOwn(response,'rows')||
    !Array.isArray(response.rows)||!Number.isSafeInteger(rowLimit)||
    rowLimit<1||rowLimit>1000||response.rows.length>rowLimit)
    throw Error('GSC page API: invalid bounded response');
  if(response.responseAggregationType!==undefined&&
    response.responseAggregationType!=='byPage')
    throw Error('GSC page API: unexpected aggregation type');
  if(response.metadata!==undefined&&(!plain(response.metadata)||
    Reflect.ownKeys(response.metadata).length!==0))
    throw Error('GSC page API: incomplete or unknown metadata');

  const observed=new Map(),seen=new Set();
  let clicks=0,impressions=0;
  for(const row of response.rows){
    if(!allowed(row,FIELDS,true)||!Array.isArray(row.keys)||
      row.keys.length!==1||typeof row.keys[0]!=='string')
      throw Error('GSC page API: invalid page row');
    // parseObservedPage blocks foreign domains, traversal and credentials.
    const source=row.keys[0];
    const parsed=parseObservedPage(source);
    if(seen.has(source))
      throw Error('GSC page API: duplicated page key');
    seen.add(source);
    if(!Number.isSafeInteger(row.clicks)||row.clicks<0||
      !Number.isSafeInteger(row.impressions)||row.impressions<0||
      row.clicks>row.impressions||
      typeof row.ctr!=='number'||!Number.isFinite(row.ctr)||row.ctr<0||
      row.ctr>1||(row.impressions===0&&row.ctr!==0)||
      (row.impressions>0&&Math.abs(row.ctr-row.clicks/row.impressions)>0.02)||
      typeof row.position!=='number'||!Number.isFinite(row.position)||
      row.position<1)
      throw Error('GSC page API: inconsistent metrics');
    clicks+=row.clicks;impressions+=row.impressions;
    if(!Number.isSafeInteger(clicks)||!Number.isSafeInteger(impressions))
      throw Error('GSC page API: metric overflow');
    const key=classifyKey(parsed);
    if(observed.has(key))
      throw Error('GSC page API: ambiguous variants');
    observed.set(key,{clicks:row.clicks,impressions:row.impressions,
      averagePosition:row.position});
  }
  // Feed only the original URL column into the existing CSV path/host gate.
  // Never log this CSV or write it into a public repository.
  const csv='Page\n'+response.rows.map(row=>'"'+
    row.keys[0].replaceAll('"','""')+'"').join('\n')+'\n';
  const inventory=response.rows.length?reviewGscPagesCsv(csv):null;
  const rows=(inventory?.rows??[]).map(item=>{
    const key=[item.host,item.from,item.queryOrFragmentSuppressed,
      item.unusualPath].join('\0');
    const metrics=observed.get(key);
    if(!metrics)throw Error('GSC page API: inventory reconciliation failed');
    return {host:item.host,path:item.from,state:item.state,
      proposedTarget:item.proposedTarget,
      queryOrFragmentSuppressed:item.queryOrFragmentSuppressed,
      clicks:metrics.clicks,impressions:metrics.impressions,
      averagePosition:metrics.averagePosition};
  }).sort((a,b)=>b.impressions-a.impressions||a.path.localeCompare(b.path));
  return {
    contractVersion:'imagine.comercial.gsc-api-page-review.v1',
    sourceType:'operator_supplied_api_shaped_pages_not_verified',
    status:'REVIEW_ONLY_NO_REDIRECTS_APPROVED',
    summary:{
      rowsReceived:response.rows.length,
      reviewedRows:rows.length,clicks,impressions,
      legacyCandidateRows:rows.filter(r=>r.state==='legacy_candidate_requires_approval').length,
      heldRows:rows.filter(r=>r.state.includes('hold')).length,
      unknownRows:rows.filter(r=>r.state==='unmapped_requires_investigation').length,
      sourceMayBeTruncated:response.rows.length===rowLimit
    },
    rows,
    approvedRedirects:0,
    googleOriginVerified:false,
    customerDataPublicationAuthorized:false,
    productionRedirectsAuthorized:false,
    limitations:[
      'These rows are supplied offline and do not prove Google ownership or complete history.',
      'Click and impression totals cover supplied rows only.',
      'Each legacy path requires editorial and legal equivalence review before a 301.'
    ]
  };
}

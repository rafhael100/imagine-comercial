/**
 * F68: Review FIRST-PARTY GSC Search Analytics JSON strictly OFFLINE.
 * Accepts page-dimension rows only. Drops clicks, CTR, impressions, position,
 * query dimensions and arbitrary provider metadata. Never grants redirects.
 */
import {reviewGscPagesCsv} from './gsc-inventory-review.mjs';

const approvedProperties=new Set([
  'https://www.imaginecomunicacao.com.br/',
  'https://imaginecomunicacao.com.br/',
  'sc-domain:imaginecomunicacao.com.br'
]);
const MAX_ROWS=10000;
const genericError=()=>new Error('F68: invalid private GSC page export');
export function reviewGscSearchAnalyticsPages(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
    !approvedProperties.has(payload.siteUrl)||
    !Array.isArray(payload.dimensions)||payload.dimensions.length!==1||
    payload.dimensions[0]!=='page'||
    !Array.isArray(payload.rows)||payload.rows.length<1||
    payload.rows.length>MAX_ROWS)
    throw genericError();
  const urls=[];
  for(const row of payload.rows){
    if(!row||typeof row!=='object'||Array.isArray(row)||
      !Array.isArray(row.keys)||row.keys.length!==1||
      typeof row.keys[0]!=='string'||row.keys[0].length>4096)
      throw genericError();
    // CSV quoting is strict: all other fields are intentionally ignored.
    // The existing F26 parser rejects foreign hosts, traversal, query tokens
    // in report output and any embedded control or malformed URL.
    urls.push('"'+row.keys[0].replaceAll('"','""')+'"');
  }
  const reviewed=reviewGscPagesCsv('Page\n'+urls.join('\n')+'\n');
  return Object.freeze({
    ...reviewed,
    source:'PRIVATE_GSC_PAGE_ONLY_NO_METRICS',
    metricsDiscarded:true,
    approvedRedirects:0,
    productionAuthorized:false
  });
}

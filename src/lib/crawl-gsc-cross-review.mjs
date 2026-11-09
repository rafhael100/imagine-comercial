/**
 * F27 — confronta exportações locais de GSC e crawler.
 * Não faz rede, não cria redirecionamentos nem declara equivalência editorial.
 */
import {legacyUrls} from '../data/legacy-urls.mjs';
import {parseCsvStrict,parseObservedPage,normalizedHeader} from './gsc-inventory-review.mjs';

const addressNames=new Set(['address','url','urls','endereco','endereco da url',
  'endereco web','pagina','page','pages']);
const statusNames=new Set(['status code','status','http status','codigo de status',
  'codigo de resposta','http code']);
const statusGroups={
  200:'http_200_requires_editorial_review',
  301:'existing_permanent_redirect_requires_trace',
  302:'existing_temporary_redirect_requires_trace',
  307:'existing_temporary_redirect_requires_trace',
  308:'existing_permanent_redirect_requires_trace',
  404:'http_not_found_requires_history_check',
  410:'http_gone_requires_history_check'
};

export function reviewLegacyCrawlCsv(content,{inventory=legacyUrls}={}) {
  const csv=parseCsvStrict(content);
  const headers=csv[0].map(normalizedHeader);
  const addresses=headers.flatMap((h,i)=>addressNames.has(h)?[i]:[]);
  const statuses=headers.flatMap((h,i)=>statusNames.has(h)?[i]:[]);
  if(addresses.length!==1 || statuses.length!==1 || addresses[0]===statuses[0])
    throw new Error('crawl CSV: exactly one address and one HTTP status column required');
  const inventoryByPath=new Map(inventory.map(v=>[v.from,v]));
  const records=new Map();
  for(const cells of csv.slice(1)){
    const page=parseObservedPage(cells[addresses[0]]);
    const rawCode=cells[statuses[0]].trim();
    if(!/^(?:0|[1-5][0-9]{2})$/.test(rawCode))
      throw new Error('crawl CSV: invalid HTTP status');
    const code=Number(rawCode);
    // Preserve host/variant in audit key: apex versus www must never be silently merged.
    const key=page.host+'\0'+page.from+'\0'+page.hasQuery+'\0'+page.unusualPath;
    if(records.has(key)){
      if(records.get(key).statusCode!==code)
        throw new Error('crawl CSV: conflicting HTTP status for one observed URL');
      continue;
    }
    let state;
    if(page.hasQuery||page.unusualPath)state='variant_hold_for_manual_review';
    else if(code===0||code>=500)state='crawl_failed_requires_retry';
    else state=statusGroups[code]??'other_http_status_requires_review';
    const local=inventoryByPath.get(page.from);
    records.set(key,Object.freeze({
      host:page.host,from:page.from,statusCode:code,state,
      legacyClassification:local?local.status:'not_in_local_legacy_inventory',
      queryOrFragmentSuppressed:page.hasQuery,
      unusualPath:page.unusualPath
    }));
  }
  const rows=[...records.values()].sort((a,b)=>a.host.localeCompare(b.host)||
    a.from.localeCompare(b.from)||a.statusCode-b.statusCode);
  return Object.freeze({
    schema:'imagine.comercial.crawl-inventory-review.v1',
    mode:'OFFLINE_CRAWL_REVIEW_ONLY_NO_REDIRECTS_APPROVED',
    inputRows:csv.length-1,
    uniqueRows:rows.length,
    existingRedirects:rows.filter(x=>[301,302,307,308].includes(x.statusCode)).length,
    failedOrMissing:rows.filter(x=>x.statusCode===0||x.statusCode>=500||
      [404,410].includes(x.statusCode)).length,
    rows:Object.freeze(rows)
  });
}
const matchKey = item => item.host+'\0'+item.from+'\0'+
  Boolean(item.queryOrFragmentSuppressed)+'\0'+Boolean(item.unusualPath);

export function crossCheckGscAndCrawl(gsc,crawl) {
  if(gsc?.schema!=='imagine.comercial.gsc-inventory-review.v1' ||
     crawl?.schema!=='imagine.comercial.crawl-inventory-review.v1' ||
     !Array.isArray(gsc.rows)||!Array.isArray(crawl.rows))
    throw new Error('cross-source: validated GSC and crawl reviews required');
  const mapGsc=new Map(gsc.rows.map(x=>[matchKey(x),x]));
  const mapCrawl=new Map(crawl.rows.map(x=>[matchKey(x),x]));
  const onlyGsc=gsc.rows.filter(x=>!mapCrawl.has(matchKey(x)));
  const onlyCrawl=crawl.rows.filter(x=>!mapGsc.has(matchKey(x)));
  const both=crawl.rows.filter(x=>mapGsc.has(matchKey(x)));
  const candidateEvidence=both.filter(x=>x.statusCode===200 &&
    !x.queryOrFragmentSuppressed&&!x.unusualPath &&
    mapGsc.get(matchKey(x))?.state==='legacy_candidate_requires_approval');
  const needsInvestigation=both.filter(x=>x.statusCode!==200 || x.unusualPath ||
    x.queryOrFragmentSuppressed);
  const safeEvidence=r=>({host:r.host,from:r.from});
  return Object.freeze({
    schema:'imagine.comercial.seo-two-source-review.v1',
    mode:'TWO_UNTRUSTED_OFFLINE_SOURCES_NO_301_AUTHORIZATION',
    gscCount:gsc.uniqueRows,
    crawlCount:crawl.uniqueRows,
    observedOnBoth:both.length,
    gscOnly:Object.freeze(onlyGsc.map(safeEvidence)),
    crawlOnly:Object.freeze(onlyCrawl.map(x=>({
      ...safeEvidence(x),statusCode:x.statusCode
    }))),
    existingRedirectsNeedingTrace:crawl.existingRedirects,
    missingOrFailedNeedingReview:crawl.failedOrMissing,
    candidatesWithTwoSourceEvidence:Object.freeze(candidateEvidence.map(safeEvidence)),
    conflictingHttpEvidence:Object.freeze(needsInvestigation.map(x=>({
      ...safeEvidence(x),statusCode:x.statusCode,state:x.state
    }))),
    approved301Count:0
  });
}

/**
 * F26 — Auditoria OFFLINE de exportação CSV de páginas do Search Console.
 * Nunca cria _redirects, nunca altera URLs em produção e nunca aprova regras.
 * Evita persistir parâmetros de URL, que podem conter tokens ou dados pessoais.
 */
import {legacyUrls} from '../data/legacy-urls.mjs';
import {sitePages} from '../data/services.mjs';

const MAX_BYTES=2*1024*1024;
const MAX_ROWS=10000;
const MAX_COLS=12;
const allowedHosts=new Set(['imaginecomunicacao.com.br','www.imaginecomunicacao.com.br']);
const canonicalPages=new Set(sitePages.map(page=>page.path));
const headerAliases=new Set(['page','pages','top pages','top page','url','urls',
  'pagina','paginas','pagina principal','paginas principais','principais paginas']);
export const normalizedHeader = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().trim().replace(/\s+/g,' ');

export function parseCsvStrict(content) {
  if(typeof content!=='string' || Buffer.byteLength(content,'utf8')>MAX_BYTES ||
     content.includes('\0')) throw new Error('GSC CSV: invalid input size or NUL');
  const source=content.replace(/^\uFEFF/,'');
  const first=source.split(/\r?\n/,1)[0];
  if(!first.trim())throw new Error('GSC CSV: empty header');
  const commas=(first.match(/,/g)||[]).length, semis=(first.match(/;/g)||[]).length;
  const separator=semis>commas?';':',';
  const rows=[];
  let row=[],cell='',quoted=false,closed=false;
  const endCell=()=>{
    if(Buffer.byteLength(cell,'utf8')>4096)throw new Error('GSC CSV: oversized cell');
    row.push(cell); cell='';closed=false;
    if(row.length>MAX_COLS)throw new Error('GSC CSV: too many columns');
  };
  const endRow=()=>{
    endCell();
    if(row.some(v=>v.trim()!==''))rows.push(row);
    row=[];
    if(rows.length>MAX_ROWS+1)throw new Error('GSC CSV: too many rows');
  };
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(quoted){
      if(ch==='"'){
        if(source[i+1]==='"'){cell+='"';i++;}
        else{quoted=false;closed=true;}
      }else cell+=ch;
      continue;
    }
    if(ch==='"'){
      if(cell!=='' || closed)throw new Error('GSC CSV: malformed quote');
      quoted=true;
    }else if(ch===separator){endCell();}
    else if(ch==='\r'||ch==='\n'){
      if(ch==='\r'&&source[i+1]==='\n')i++;
      endRow();
    }else{
      if(closed && ch!==' ' && ch!=='\t')throw new Error('GSC CSV: extra text after quote');
      cell+=ch;
    }
  }
  if(quoted)throw new Error('GSC CSV: unmatched quote');
  if(cell!==''||closed||row.length)endRow();
  if(rows.length<2)throw new Error('GSC CSV: missing page rows');
  const length=rows[0].length;
  for(const row of rows)if(row.length!==length)throw new Error('GSC CSV: inconsistent columns');
  return rows;
}

export function parseObservedPage(value) {
  if(typeof value!=='string' || value.length>4096 || !value.trim() ||
     value.includes('\\') || /[\r\n\0]/.test(value))
    throw new Error('GSC CSV: invalid URL cell');
  const input=value.trim();
  if(/[<>]/.test(input))throw new Error('GSC CSV: HTML in URL cell');
  // WHATWG URL normalizes dot segments (including encoded ones); refuse them
  // before parsing so a malicious source cannot silently become a different URL.
  const rawWithoutQuery=input.split(/[?#]/,1)[0];
  if(/(?:^|\/)\.{1,2}(?=\/|$)/.test(rawWithoutQuery) ||
     /%(?:2e|2f|5c)/i.test(rawWithoutQuery)) {
    throw new Error('GSC CSV: traversal or encoded slash in source URL');
  }
  let url;
  try {
    url=new URL(input,'https://imaginecomunicacao.com.br');
  }catch{throw new Error('GSC CSV: malformed URL');}
  if(!['http:','https:'].includes(url.protocol) ||
     !allowedHosts.has(url.hostname.toLowerCase()) ||
     url.username || url.password || url.port ||
     !input.startsWith('/') && !/^https?:\/\//i.test(input))
    throw new Error('GSC CSV: foreign or unsafe host/URL');
  // URLs with encoded segments, fragments or queries remain manual HOLD;
  // no decoding or truncation can silently create an approved redirect.
  const path=url.pathname;
  if(path.length>1024 || !/^\/[a-zA-Z0-9._~%/-]*$/.test(path) ||
     path.includes('//') || path.split('/').some(part=>part==='.'||part==='..'))
    throw new Error('GSC CSV: unsafe path');
  return Object.freeze({
    host:url.hostname.toLowerCase(),
    from:path,
    hasQuery:url.search!=='' || url.hash!=='',
    unusualPath:path.includes('%'),
    httpSource:url.protocol==='http:'
  });
}

export function reviewGscPagesCsv(content,{inventory=legacyUrls}={}){
  const rows=parseCsvStrict(content);
  const headings=rows[0].map(normalizedHeader);
  const matches=headings.map((h,i)=>headerAliases.has(h)?i:-1).filter(i=>i>=0);
  if(matches.length!==1)throw new Error('GSC CSV: unique Page/URL column required');
  const index=matches[0], legacy=new Map(inventory.map(e=>[e.from,e]));
  const seen=new Set(), results=[];
  for(const row of rows.slice(1)){
    const page=parseObservedPage(row[index]);
    const key=page.host+'\0'+page.from+'\0'+page.hasQuery+'\0'+page.unusualPath+'\0'+page.httpSource;
    if(seen.has(key))continue;
    seen.add(key);
    const entry=legacy.get(page.from);
    let state,proposedTarget=null;
    if(page.hasQuery || page.unusualPath)state='variant_hold_for_manual_review';
    else if(page.httpSource)state='protocol_hold_for_manual_review';
    else if(canonicalPages.has(page.from))state='current_public_route_no_redirect';
    else if(!entry)state='unmapped_requires_investigation';
    else if(entry.status==='hold')state='legacy_hold_requires_review';
    else if(entry.status==='candidate') {
      state='legacy_candidate_requires_approval';
      proposedTarget=entry.to;
    }else state='legacy_approved_state_requires_separate_release_gate';
    results.push(Object.freeze({
      host:page.host,from:page.from,observedHttp:page.httpSource,
      queryOrFragmentSuppressed:page.hasQuery,unusualPath:page.unusualPath,
      state,proposedTarget
    }));
  }
  results.sort((a,b)=>a.host.localeCompare(b.host)||a.from.localeCompare(b.from)||
    Number(a.observedHttp)-Number(b.observedHttp)||a.state.localeCompare(b.state));
  const observedLegacy=new Set(results.filter(x=>legacy.has(x.from)).map(x=>x.from));
  return Object.freeze({
    schema:'imagine.comercial.gsc-inventory-review.v1',
    mode:'OFFLINE_UNTRUSTED_EVIDENCE_NO_REDIRECTS_APPROVED',
    inputRows:rows.length-1,
    uniqueRows:results.length,
    candidateRows:results.filter(x=>x.state==='legacy_candidate_requires_approval').length,
    heldRows:results.filter(x=>x.state.includes('hold')).length,
    unknownRows:results.filter(x=>x.state==='unmapped_requires_investigation').length,
    missingLocalLegacyPaths:Object.freeze([...legacy.keys()].filter(p=>!observedLegacy.has(p)).sort()),
    rows:Object.freeze(results)
  });
}

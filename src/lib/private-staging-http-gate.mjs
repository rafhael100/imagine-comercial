/**
 * F159 — passive HTTP smoke gate for an independently started, private
 * staging endpoint forwarded to 127.0.0.1. No deployment and no DNS.
 *
 * The caller cannot supply a hostname or arbitrary URL. All destinations
 * come from the versioned, public site and legacy inventories.
 */
import {sitePages,toAbsoluteUrl} from '../data/services.mjs';
import {legacyUrls} from '../data/legacy-urls.mjs';
import {localHeaderProfile} from './security-headers-preview.mjs';

const publicSamples=Object.freeze([
  '/','/servicos/','/conteudos/','/contato/'
]);
const pendingSamples=Object.freeze(
  legacyUrls.filter(x=>x.status==='hold').map(x=>x.from)
);
const catalog=new Set(sitePages.map(x=>x.path));
if(publicSamples.some(x=>!catalog.has(x))||pendingSamples.length!==18)
  throw Error('F159: stale approved route manifest');

async function boundedHtml(response) {
  if(!response.body||typeof response.body.getReader!=='function')
    throw Error('F159: missing HTML stream');
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let size=0,text='';
  try{
    for(;;){
      const {value,done}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>1024*1024)throw Error('F159: response exceeds bounded HTML size');
      text+=decoder.decode(value,{stream:true});
    }
    return text+decoder.decode();
  }finally{reader.releaseLock();}
}
const hasMeta=(html,name,value)=>new RegExp(
  '<meta\\b[^>]*\\bname=["\\x27]'+name+'["\\x27][^>]*\\bcontent=["\\x27]'+
  value+'["\\x27]','i').test(html);
const canonical=html=>{
  const match=/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/gi;
  return [...html.matchAll(match)].map(x=>x[1]);
};

export async function reviewPrivateStagingHttp({
  port,transport=fetch,timeoutMs=5000
}={}){
  if(!Number.isSafeInteger(port)||port<1024||port>65535||
    typeof transport!=='function'||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>10000)
    throw Error('F159: invalid private staging parameters');

  // Construct all URLs internally — never accept caller-supplied URLs,
  // tokens, alternate hostname, auth headers, paths or redirect overrides.
  const base='http://127.0.0.1:'+port;
  let checked=0,good=0,held=0;
  for(const path of [...publicSamples,...pendingSamples]){
    let response;
    try{
      response=await transport(base+path,{
        method:'GET',redirect:'manual',credentials:'omit',
        signal:AbortSignal.timeout(timeoutMs)
      });
      if(!(response instanceof Response))
        throw Error('F159: invalid HTTP response');
      const expected=publicSamples.includes(path)?200:404;
      if(response.status!==expected||
        response.redirected||
        !/^text\/html(?:;|$)/i.test(response.headers.get('content-type')??''))
        throw Error('F159: unexpected status, redirect or media type');
      for(const [name,value] of localHeaderProfile){
        if(response.headers.get(name)!==value)
          throw Error('F159: missing reviewed security header');
      }
      const html=await boundedHtml(response);
      const canonicalLinks=canonical(html);
      if(expected===200){
        if(canonicalLinks.length!==1||
          canonicalLinks[0]!==toAbsoluteUrl(path)||
          !hasMeta(html,'robots','index,follow')||
          !/<h1\b/i.test(html))
          throw Error('F159: public response SEO evidence mismatch');
        good++;
      }else{
        if(canonicalLinks.length!==0||
          !hasMeta(html,'robots','noindex,nofollow')||
          /<script\b[^>]*type=["']application\/ld\+json["']/i.test(html)||
          !/<h1\b/i.test(html))
          throw Error('F159: held legacy page must be safe 404');
        held++;
      }
      checked++;
    }catch{
      // Do not include URLs, query strings, response bodies, headers,
      // private server names or arbitrary exception messages in output.
      throw Error('F159: private staging HTTP gate failed closed');
    }
  }
  return Object.freeze({
    schema:'imagine.comercial.private-staging-http-review.v1',
    scope:'LOOPBACK_ONLY_PRIVATE_REVIEW',
    reviewedPublicPages:good,
    heldLegacyPages:held,
    totalHttpChecks:checked,
    headerProfile:'F28_REVIEWED_HEADERS',
    outboundExternalRequests:false,
    redirectsEnabled:false,
    deploymentAuthorized:false,
    deploymentPerformed:false,
    result:'STAGING_HTTP_SMOKE_ONLY_NO_RELEASE_AUTHORITY'
  });
}

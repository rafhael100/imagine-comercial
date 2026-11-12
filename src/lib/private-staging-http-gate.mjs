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
if(publicSamples.some(x=>!catalog.has(x))||pendingSamples.length!==20)
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
  port,transport=fetch,timeoutMs=5000,basicAuth
}={}){
  if(!Number.isSafeInteger(port)||port<1024||port>65535||
    typeof transport!=='function'||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>10000)
    throw Error('F159: invalid private staging parameters');

  // F166: only the trusted private operator CLI can opt into Basic Auth.
  // No remote URL, cookies or login fields can come from a visitor.
  if(basicAuth!==undefined){
    if(typeof basicAuth!=='string'||basicAuth.length>256||
       !/^Basic [A-Za-z0-9+/]+={0,2}$/.test(basicAuth))
      throw Error('F166: invalid private staging review credentials');
    const encoded=basicAuth.slice(6),decoded=Buffer.from(encoded,'base64');
    const pair=decoded.toString('utf8');
    if(decoded.toString('base64')!==encoded||
      !/^reviewer:[\x21-\x7e]{24,128}$/.test(pair))
      throw Error('F166: invalid private staging reviewer identity');
  }
  const hasToken=(header,token)=>typeof header==='string'&&
    header.toLowerCase().split(',').map(x=>x.trim()).includes(token);
  const noPrivateState=response=>
    hasToken(response.headers.get('x-robots-tag'),'noindex')&&
    hasToken(response.headers.get('x-robots-tag'),'nofollow')&&
    hasToken(response.headers.get('cache-control'),'no-store')&&
    !response.headers.has('set-cookie');
  const base='http://127.0.0.1:'+port;
  // F168: a protected homepage alone is not enough. Every published
  // sample and held legacy URL, plus public SEO/error/asset endpoints, must
  // deny visitors BEFORE any privileged HTTP review can succeed.
  const unauthenticatedPaths=Object.freeze([
    ...publicSamples,...pendingSamples,
    '/robots.txt','/sitemap.xml','/perguntas-frequentes/',
    '/_astro/__imagine_private_access_probe__.js'
  ]);
  let unauthenticatedRoutesDenied=0;
  if(basicAuth!==undefined){
    try{
      for(const path of unauthenticatedPaths){
        const withoutAuth=await transport(base+path,{
          method:'GET',redirect:'manual',credentials:'omit',
          signal:AbortSignal.timeout(timeoutMs)
        });
        if(!(withoutAuth instanceof Response)||withoutAuth.status!==401||
          withoutAuth.redirected||
          !/^Basic\s/i.test(withoutAuth.headers.get('www-authenticate')??'')||
          !noPrivateState(withoutAuth))
          throw Error('F168: unauthenticated staging path is exposed');
        await withoutAuth.body?.cancel();
        unauthenticatedRoutesDenied++;
      }
    }catch{
      throw Error('F168: private staging routes are not all protected');
    }
  }
  let checked=0,good=0,held=0;
  for(const path of [...publicSamples,...pendingSamples]){
    let response;
    try{
      response=await transport(base+path,{
        method:'GET',redirect:'manual',credentials:'omit',
        ...(basicAuth===undefined?{}:{headers:{Authorization:basicAuth}}),
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
      // F171: authenticated success/404 must remain non-indexable and
      // non-cacheable in the private staging HTTP surface. No cookies.
      if(basicAuth!==undefined&&!noPrivateState(response))
        throw Error('F171: authenticated staging private headers absent');
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
    ...(basicAuth===undefined?{}:{
      unauthenticatedEntryDenied:unauthenticatedRoutesDenied===unauthenticatedPaths.length,
      unauthenticatedRoutesDenied
    }),
    result:'STAGING_HTTP_SMOKE_ONLY_NO_RELEASE_AUTHORITY'
  });
}

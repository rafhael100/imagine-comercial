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
import {timingSafeEqual} from 'node:crypto';

const publicSamples=Object.freeze([
  '/','/servicos/','/conteudos/','/contato/'
]);
const pendingSamples=Object.freeze(
  legacyUrls.filter(x=>x.status==='hold').map(x=>x.from)
);
const catalog=new Set(sitePages.map(x=>x.path));
if(publicSamples.some(x=>!catalog.has(x))||pendingSamples.length!==22)
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
async function boundedBytes(response,limit=10*1024*1024){
  if(!response.body||typeof response.body.getReader!=='function')
    throw Error('F235: missing asset stream');
  const reader=response.body.getReader();
  const chunks=[];let size=0;
  try{
    for(;;){
      const {value,done}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))throw Error('F235: invalid asset chunk');
      size+=value.byteLength;
      if(size>limit)throw Error('F235: asset exceeds limit');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks,size);
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
  port,transport=fetch,timeoutMs=5000,basicAuth,fullCoverage=false,expectedHtmlByPath,expectedAssetsByPath
}={}){
  if(!Number.isSafeInteger(port)||port<1024||port>65535||
    typeof transport!=='function'||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>10000||
    typeof fullCoverage!=='boolean')
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
  if(fullCoverage&&basicAuth===undefined)
    throw Error('F231: authenticated private review is required for full coverage');
  // F234: optional operator-only exact HTML comparison with pinned local dist.
  // Do not trust arbitrary caller-supplied paths, extra keys or map mutation.
  let htmlExpected;
  if(expectedHtmlByPath!==undefined){
    if(!fullCoverage||basicAuth===undefined||
       !(expectedHtmlByPath instanceof Map)||
       expectedHtmlByPath.size!==sitePages.length+1)
      throw Error('F234: pinned HTML parity requires full private authenticated review');
    const allowed=new Set([...sitePages.map(x=>x.path),'__404_html__']);
    for(const [path,html] of expectedHtmlByPath){
      if(!allowed.has(path)||typeof html!=='string'||
         html.length===0||Buffer.byteLength(html,'utf8')>1024*1024)
        throw Error('F234: invalid pinned HTML evidence');
    }
    if([...allowed].some(path=>!expectedHtmlByPath.has(path)))
      throw Error('F234: incomplete pinned HTML evidence');
    htmlExpected=new Map(expectedHtmlByPath);
  }
  // F235: only files enumerated by the independent pinned dist reader.
  // Disallow path injection, symlinks, duplicate URLs and arbitrary fetches.
  let assetExpected;
  if(expectedAssetsByPath!==undefined){
    if(!fullCoverage||basicAuth===undefined||htmlExpected===undefined||
       !(expectedAssetsByPath instanceof Map)||expectedAssetsByPath.size<2||
       expectedAssetsByPath.size>100)
      throw Error('F235: bounded asset parity requires pinned private HTML review');
    assetExpected=new Map();
    for(const [path,bytes] of expectedAssetsByPath){
      if(typeof path!=='string'||path.length>300||
         !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:txt|xml|css|js|svg|png|jpg|jpeg|webp|avif|ico|woff|woff2)$/.test(path)||
         path.includes('..')||path.includes('//')||
         !Buffer.isBuffer(bytes)||bytes.length>10*1024*1024)
        throw Error('F235: invalid bounded asset file');
      assetExpected.set(path,Buffer.from(bytes));
    }
    if(!assetExpected.has('/robots.txt')||!assetExpected.has('/sitemap.xml'))
      throw Error('F235: SEO assets must be pinned');
  }
  const reviewedPublic=fullCoverage?sitePages.map(x=>x.path):publicSamples;
  const reviewedLegacy=fullCoverage?legacyUrls.map(x=>x.from):pendingSamples;
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
  const unauthenticatedPaths=Object.freeze([...new Set([
    ...reviewedPublic,...reviewedLegacy,
    '/robots.txt','/sitemap.xml','/perguntas-frequentes/',
    '/_astro/__imagine_private_access_probe__.js',
    ...(assetExpected===undefined?[]:[...assetExpected.keys()])
  ])]);
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
  for(const path of [...reviewedPublic,...reviewedLegacy]){
    let response;
    try{
      response=await transport(base+path,{
        method:'GET',redirect:'manual',credentials:'omit',
        ...(basicAuth===undefined?{}:{headers:{Authorization:basicAuth}}),
        signal:AbortSignal.timeout(timeoutMs)
      });
      if(!(response instanceof Response))
        throw Error('F159: invalid HTTP response');
      const expected=reviewedPublic.includes(path)?200:404;
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
      if(htmlExpected!==undefined &&
         html!==htmlExpected.get(expected===200?path:'__404_html__'))
        throw Error('F234: response does not match pinned HTML bytes');
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
  let checkedAssets=0;
  if(assetExpected!==undefined){
    for(const [path,expected] of assetExpected){
      try{
        const response=await transport(base+path,{
          method:'GET',redirect:'manual',credentials:'omit',
          headers:{Authorization:basicAuth},
          signal:AbortSignal.timeout(timeoutMs)
        });
        if(!(response instanceof Response)||response.status!==200||
          response.redirected||!noPrivateState(response)||
          response.headers.get('content-type')?.toLowerCase().startsWith('text/html')){
          throw Error('F235: expected private static asset');
        }
        for(const [name,value] of localHeaderProfile){
          if(response.headers.get(name)!==value)
            throw Error('F235: static asset missing security header');
        }
        const body=await boundedBytes(response);
        if(body.length!==expected.length||!timingSafeEqual(body,expected))
          throw Error('F235: static asset bytes differ');
        checkedAssets++;
      }catch{
        throw Error('F235: private static asset parity failed closed');
      }
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
    ...(fullCoverage?{
      coverageProfile:'COMPLETE_PRIVATE_CATALOG_AND_LEGACY',
      legacyCandidatesStillHeld:legacyUrls.filter(x=>x.status==='candidate').length,
      ...(htmlExpected===undefined?{}:{
        servedHtmlMatchesLocalPinnedBuild:true,
        pinnedHtmlComparisons:checked
      })
    }:{}),
    ...(assetExpected===undefined?{}:{
      servedStaticAssetsMatchPinnedBuild:true,
      verifiedStaticAssets:checkedAssets
    }),
    result:'STAGING_HTTP_SMOKE_ONLY_NO_RELEASE_AUTHORITY'
  });
}

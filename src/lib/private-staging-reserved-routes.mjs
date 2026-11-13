/**
 * F293 — actual protected private staging 404 responses for reserved paths.
 * Reject a misleading HTTP 404 whose body accidentally contains a secret:
 * the complete response bytes MUST equal the independently pinned 404.html.
 * No public URLs, dynamic paths, writes, deploy or release authorization.
 */
import {localHeaderProfile} from './security-headers-preview.mjs';
import {timingSafeEqual} from 'node:crypto';

const HOLD='F293: reserved private staging paths not verified (HOLD)';
const RESERVED=Object.freeze([
  '/.env',
  '/.env.local',
  '/.git/config',
  '/.github/workflows/ci.yml',
  '/_redirects',
  '/_headers'
]);
function verifyCredentials(header){
  if(typeof header!=='string'||header.length>256||
    !/^Basic [A-Za-z0-9+/]+={0,2}$/.test(header))throw Error(HOLD);
  const encoded=header.slice(6),value=Buffer.from(encoded,'base64');
  if(value.toString('base64')!==encoded||
    !/^reviewer:[\x21-\x7e]{24,128}$/.test(value.toString('utf8')))
    throw Error(HOLD);
}
function safeHeaders(response){
  if(!(response instanceof Response)||response.redirected||
     response.headers.has('location')||response.headers.has('set-cookie')||
     response.headers.has('access-control-allow-origin'))return false;
  const tokens=name=>(response.headers.get(name)||'').toLowerCase()
    .split(',').map(part=>part.trim());
  return tokens('x-robots-tag').includes('noindex')&&
    tokens('x-robots-tag').includes('nofollow')&&
    tokens('cache-control').includes('no-store')&&
    [...localHeaderProfile].every(([name,value])=>
      response.headers.get(name)===value);
}
async function boundedBytes(response){
  const reader=response.body?.getReader();
  if(!reader)throw Error(HOLD);
  const chunks=[];
  let size=0;
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array))throw Error(HOLD);
      size+=value.byteLength;
      if(size>1024*1024)throw Error(HOLD);
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks,size);
  }finally{
    reader.releaseLock();
  }
}

export async function reviewPrivateStagingReservedRoutes({
  port,basicAuth,expected404Html,transport=fetch,timeoutMs=5000
}={}){
  if(!Number.isSafeInteger(port)||port<1024||port>65535||
    typeof transport!=='function'||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>10000||
    typeof expected404Html!=='string'||expected404Html.length<100||
    Buffer.byteLength(expected404Html,'utf8')>1024*1024)
    throw Error(HOLD);
  verifyCredentials(basicAuth);
  const pinned=Buffer.from(expected404Html,'utf8');
  const base='http://127.0.0.1:'+port;
  let authenticatedDenied=0,anonymousDenied=0;
  try{
    for(const path of RESERVED){
      for(const authorized of [false,true]){
        const response=await transport(base+path,{
          method:'GET',redirect:'manual',credentials:'omit',
          ...(authorized?{headers:{Authorization:basicAuth}}:{}),
          signal:AbortSignal.timeout(timeoutMs)
        });
        if(!safeHeaders(response))throw Error(HOLD);
        if(!authorized&&response.status===401){
          if(!/^Basic\s/i.test(response.headers.get('www-authenticate')||''))
            throw Error(HOLD);
          await response.body?.cancel();
          anonymousDenied++;
          continue;
        }
        if(response.status!==404||
           !/^text\/html(?:;|$)/i.test(response.headers.get('content-type')||''))
          throw Error(HOLD);
        const received=await boundedBytes(response);
        if(received.length!==pinned.length||
          !timingSafeEqual(received,pinned))throw Error(HOLD);
        if(authorized)authenticatedDenied++;else anonymousDenied++;
      }
    }
  }catch{
    // Never emit server response, route, credentials or local file paths.
    throw Error(HOLD);
  }
  return Object.freeze({
    schema:'imagine.comercial.private-staging-reserved-paths.v1',
    status:'RESERVED_PATHS_DENIED_PINNED_404_NO_RELEASE_AUTHORITY',
    protectedPaths:RESERVED.length,
    anonymousProtected:anonymousDenied,
    authenticatedPinned404:authenticatedDenied,
    totalChecks:anonymousDenied+authenticatedDenied,
    onlyLoopbackUsed:true,
    private404MatchesIndependentlyPinnedBuild:true,
    remoteFirewallAndTlsVerified:false,
    canCollectPublicLeads:false,
    productionAuthorized:false,
    deploymentPerformed:false
  });
}

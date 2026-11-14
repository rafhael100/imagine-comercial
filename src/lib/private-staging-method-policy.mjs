/**
 * F292 — non-deploying method policy verification of the PRIVATE loopback
 * staging server. Static assertions cannot prove actual Nginx access control.
 *
 * Probe only six hard-coded reviewed routes over 127.0.0.1, never a caller
 * supplied host, path, public customer form, external domain or credentials.
 * This is an operator diagnostic, NOT a release authorization.
 */
import {legacyUrls} from '../data/legacy-urls.mjs';
import {localHeaderProfile} from './security-headers-preview.mjs';

const HOLD='F292: private staging HTTP method policy not verified (HOLD)';
const held=legacyUrls.find(x=>x.status==='hold')?.from;
const candidate=legacyUrls.find(x=>x.status==='candidate')?.from;
if(!held||!candidate||held===candidate)
  throw Error('F292: reviewed legacy route inventory missing');
const HEAD_PATHS=Object.freeze([
  Object.freeze({path:'/',status:200,type:'text/html'}),
  Object.freeze({path:'/contato/',status:200,type:'text/html'}),
  Object.freeze({path:'/robots.txt',status:200,type:'text/plain'}),
  Object.freeze({path:'/sitemap.xml',status:200,type:'application/xml'}),
  Object.freeze({path:held,status:404,type:'text/html'}),
  Object.freeze({path:candidate,status:404,type:'text/html'})
]);
const BLOCKED_METHODS=Object.freeze(['POST','PUT','DELETE','OPTIONS']);
const DENIED_PATHS=Object.freeze(['/', '/contato/', held]);

function verifyCredentials(header){
  if(typeof header!=='string'||header.length>256||
    !/^Basic [A-Za-z0-9+/]+={0,2}$/.test(header))
    throw Error(HOLD);
  const encoded=header.slice(6);
  const decoded=Buffer.from(encoded,'base64');
  if(decoded.toString('base64')!==encoded||
    !/^reviewer:[\x21-\x7e]{24,128}$/.test(decoded.toString('utf8')))
    throw Error(HOLD);
}

function noPrivateState(response){
  const tokens=name=>(response.headers.get(name)||'').toLowerCase()
    .split(',').map(token=>token.trim());
  return tokens('x-robots-tag').includes('noindex')&&
    tokens('x-robots-tag').includes('nofollow')&&
    tokens('cache-control').includes('no-store')&&
    !response.headers.has('set-cookie')&&
    !response.headers.has('location')&&
    !response.headers.has('access-control-allow-origin');
}

function protectHeaders(response){
  return noPrivateState(response)&&
    [...localHeaderProfile].every(([name,value])=>response.headers.get(name)===value)&&
    !response.redirected;
}
function assertResponse(response){
  if(!(response instanceof Response)||!protectHeaders(response))
    throw Error(HOLD);
}
function cancelBody(response){
  // Never decode, store, print or inspect private responses.
  // Nginx must not return a body for HEAD; blocked methods may do so.
  return response.body?.cancel();
}

export async function reviewPrivateStagingMethodPolicy({
  port,transport=fetch,timeoutMs=5000,basicAuth
}={}){
  if(!Number.isSafeInteger(port)||port<1024||port>65535||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>10000||
    typeof transport!=='function')
    throw Error(HOLD);
  verifyCredentials(basicAuth);
  const base='http://127.0.0.1:'+port;
  let anonymousHeads=0,authorizedHeads=0,blockedRequests=0;
  try{
    for(const {path,status,type} of HEAD_PATHS){
      // A public GET check does not establish that anonymous HEAD is private.
      const anonymous=await transport(base+path,{
        method:'HEAD',redirect:'manual',credentials:'omit',
        signal:AbortSignal.timeout(timeoutMs)
      });
      assertResponse(anonymous);
      if(anonymous.status!==401||anonymous.body!==null||
        !/^Basic\s/i.test(anonymous.headers.get('www-authenticate')||''))
        throw Error(HOLD);
      anonymousHeads++;

      const authorized=await transport(base+path,{
        method:'HEAD',redirect:'manual',credentials:'omit',
        headers:{Authorization:basicAuth},signal:AbortSignal.timeout(timeoutMs)
      });
      assertResponse(authorized);
      const mime=authorized.headers.get('content-type')?.split(';',1)[0].toLowerCase();
      if(authorized.status!==status||authorized.body!==null||
        (type==='application/xml'?!['application/xml','text/xml'].includes(mime):mime!==type))
        throw Error(HOLD);
      authorizedHeads++;
    }
    for(const path of DENIED_PATHS){
      for(const method of BLOCKED_METHODS){
        // Valid credentials must NOT permit any mutation or CORS preflight.
        const denied=await transport(base+path,{
          method,redirect:'manual',credentials:'omit',
          headers:{Authorization:basicAuth},signal:AbortSignal.timeout(timeoutMs)
        });
        assertResponse(denied);
        if(![403,405].includes(denied.status))throw Error(HOLD);
        await cancelBody(denied);
        blockedRequests++;
      }
    }
  }catch{
    // Never print a response, secret, route, host, HTTP header or exception.
    throw Error(HOLD);
  }
  return Object.freeze({
    schema:'imagine.comercial.private-staging-method-policy.v1',
    status:'PRIVATE_METHODS_REVIEWED_NO_RELEASE_AUTHORITY',
    anonymousHeadChallengesPassed:anonymousHeads,
    authenticatedHeadChecksPassed:authorizedHeads,
    forbiddenMethodChecksPassed:blockedRequests,
    checkedMethods:Object.freeze(['HEAD',...BLOCKED_METHODS]),
    totalChecks:anonymousHeads+authorizedHeads+blockedRequests,
    onlyLoopbackTargetUsed:true,
    noBodyContentRead:true,
    actualExternalTlsAndFirewallVerified:false,
    productionAuthorized:false,
    canCollectPublicLeads:false,
    deploymentPerformed:false
  });
}

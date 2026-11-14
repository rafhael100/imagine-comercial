/**
 * F-LEGACY-CAPTURE — opt-in readonly GET collection for exactly the 27 known
 * legacy URLs. Uses ONE of two hardcoded origins:
 * - original public website (pre-change), or
 * - authenticated localhost staging (candidate).
 *
 * Never sends cookies, form data, POSTs, credentials to a remote host,
 * response bodies to logs, or redirect-following requests. No writes here.
 */
import {createHash} from 'node:crypto';
import {legacyUrls} from '../data/legacy-urls.mjs';

export const originalOrigin='https://www.imaginecomunicacao.com.br';
export const candidateOrigin='http://127.0.0.1:4321';

async function boundedBodySha(response){
 if(!response.body||typeof response.body.getReader!=='function')
  throw Error('F-LEGACY-CAPTURE: missing response body');
 const hash=createHash('sha256'),reader=response.body.getReader();
 let bytes=0;
 try{
  for(;;){
   const {value,done}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array))throw Error('F-LEGACY-CAPTURE: unsafe response data');
   bytes+=value.byteLength;
   if(bytes>1024*1024)throw Error('F-LEGACY-CAPTURE: oversized public page');
   hash.update(value);
  }
 }finally{reader.releaseLock();}
 if(!bytes)throw Error('F-LEGACY-CAPTURE: empty public page');
 return Object.freeze({bytes,bodySha256:hash.digest('hex')});
}
function validAuth(basicAuth){
 if(typeof basicAuth!=='string'||basicAuth.length>256||
  !/^Basic [A-Za-z0-9+/]+={0,2}$/.test(basicAuth))
  return false;
 const encoded=basicAuth.slice(6),bytes=Buffer.from(encoded,'base64');
 return bytes.toString('base64')===encoded&&
  /^reviewer:[\x21-\x7e]{24,128}$/.test(bytes.toString('utf8'));
}
export async function captureLegacyHttpSnapshot({
 scope,transport=fetch,basicAuth,timeoutMs=7000
}={}){
 if(!['BEFORE_ORIGINAL','AFTER_CANDIDATE'].includes(scope)||
  typeof transport!=='function'||!Number.isSafeInteger(timeoutMs)||
  timeoutMs<1000||timeoutMs>10000||
  ((scope==='BEFORE_ORIGINAL'&&basicAuth!==undefined)||
   (scope==='AFTER_CANDIDATE'&&!validAuth(basicAuth))))
   throw Error('F-LEGACY-CAPTURE: invalid opt-in readonly source');
 const local=scope==='AFTER_CANDIDATE';
 const origin=local?candidateOrigin:originalOrigin;
 const rows=[];
 for(const {from:path} of legacyUrls){
  let response;
  try{
   response=await transport(origin+path,{
    method:'GET',redirect:'manual',credentials:'omit',
    headers:{
     Accept:'text/html',
     ...(local?{Authorization:basicAuth}:{})
    },
    signal:AbortSignal.timeout(timeoutMs)
   });
  }catch{throw Error('F-LEGACY-CAPTURE: required HTTP observation unavailable');}
  if(!(response instanceof Response)||response.redirected)
   throw Error('F-LEGACY-CAPTURE: unsafe HTTP response');
  const status=response.status;
  let mime=null,bodySha256=null,bytes=0,redirectTo=null;
  if(status===200){
   mime=response.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase();
   if(mime!=='text/html')
    throw Error('F-LEGACY-CAPTURE: unexpected public media type');
   const body=await boundedBodySha(response);
   ({bytes,bodySha256}=body);
  }else if([301,302,307,308].includes(status)){
   const target=response.headers.get('location');
   // Preserve evidence only for an exact relative same-site destination.
   if(target!==null&&/^\/(?:[a-z0-9-]+\/)*$/.test(target))
    redirectTo=target;
   await response.body?.cancel();
  }else{
   if(status<200||status>599)
    throw Error('F-LEGACY-CAPTURE: invalid HTTP status');
   await response.body?.cancel();
  }
  rows.push({path,status,mime,bodySha256,bytes,redirectTo});
 }
 return Object.freeze({
  schema:'imagine.comercial.legacy-http-snapshot.v1',scope,
  rows:Object.freeze(rows.map(x=>Object.freeze(x)))
 });
}

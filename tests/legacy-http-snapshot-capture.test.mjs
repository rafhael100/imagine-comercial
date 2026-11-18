import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {captureLegacyHttpSnapshot,originalOrigin,candidateOrigin} from '../src/lib/legacy-http-snapshot-capture.mjs';
import {reviewLegacyHttpContinuity} from '../src/lib/legacy-http-continuity-review.mjs';

const secret='correct-horse-battery-staple-very-long';
const auth='Basic '+Buffer.from('reviewer:'+secret).toString('base64');
function mockTransport({local=false,alterPath=null,alterStatus=null}={}){
 const calls=[];
 const transport=async (url,init)=>{
  calls.push({url,method:init.method,redirect:init.redirect,headers:init.headers});
  const valid=(local?candidateOrigin:originalOrigin);
  assert.ok(url.startsWith(valid+'/'),url);
  assert.equal(init.redirect,'manual');
  assert.equal(init.credentials,'omit');
  const preflight=local&&init.method==='HEAD';
  assert.equal(init.method,preflight?'HEAD':'GET');
  assert.equal(init.headers.Authorization,local&&!preflight?auth:undefined);
  const path=url.slice(valid.length);
  if(preflight){
   assert.equal(path,'/','Challenge uses the fixed loopback home only');
   return new Response(null,{status:401,headers:{
    'www-authenticate':'Basic realm="Imagine private review"'
   }});
  }
  assert.ok(legacyUrls.some(x=>x.from===path),path);
  if(path===alterPath&&alterStatus===404)
   return new Response('missing',{status:404,headers:{'content-type':'text/html'}});
  return new Response('STATIC PAGE '+path,{
   status:200,headers:{'content-type':'text/html; charset=UTF-8'}
  });
 };
 return {transport,calls};
}
test('F-LEGACY-CAPTURE collect 27 fixed-domain pages without storing body or following redirects',async()=>{
 const {transport,calls}=mockTransport();
 const before=await captureLegacyHttpSnapshot({scope:'BEFORE_ORIGINAL',transport});
 const afterMock=mockTransport({local:true});
 const after=await captureLegacyHttpSnapshot({
  scope:'AFTER_CANDIDATE',basicAuth:auth,transport:afterMock.transport
 });
 assert.equal(calls.length,27);
 assert.equal(afterMock.calls.length,28);
 assert.equal(afterMock.calls[0].method,'HEAD');
 assert.equal(afterMock.calls[0].headers.Authorization,undefined);
 assert.deepEqual(before.rows.map(x=>x.path),legacyUrls.map(x=>x.from));
 assert.equal(before.rows[0].mime,'text/html');
 assert.match(before.rows[0].bodySha256,/^[a-f0-9]{64}$/);
 assert.equal(before.rows[0].bytes,Buffer.byteLength('STATIC PAGE '+legacyUrls[0].from));
 const review=reviewLegacyHttpContinuity(before,after);
 assert.equal(review.heldPreservedExact,22);
 assert.equal(review.candidatesPreservedExact,5);
 assert.equal(review.redirectsAuthorized,0);
 assert.equal(review.newSiteCanReplaceOriginal,false);
 assert.ok(Object.isFrozen(before)&&Object.isFrozen(before.rows));
});
test('F-LEGACY-CAPTURE fail closed when a held route vanishes in the candidate',async()=>{
 const original=mockTransport(),changed=mockTransport({local:true,
  alterPath:'/en-us/termos-de-uso.html',alterStatus:404});
 const before=await captureLegacyHttpSnapshot({scope:'BEFORE_ORIGINAL',transport:original.transport});
 const after=await captureLegacyHttpSnapshot({scope:'AFTER_CANDIDATE',transport:changed.transport,basicAuth:auth});
 const result=reviewLegacyHttpContinuity(before,after);
 assert.equal(result.heldMissingOrChanged,1);
 assert.equal(result.allHeldBytePreserved,false);
});
test('F-LEGACY-CAPTURE never sends a private token to the public site',async()=>{
 const external=mockTransport();
 await assert.rejects(()=>captureLegacyHttpSnapshot({
  scope:'BEFORE_ORIGINAL',transport:external.transport,basicAuth:auth
 }),/F-LEGACY-CAPTURE:/);
 assert.equal(external.calls.length,0);
 for(const basicAuth of [undefined,'Basic bad','Bearer abc','Basic '+Buffer.from('admin:guess').toString('base64')]){
  await assert.rejects(()=>captureLegacyHttpSnapshot({
   scope:'AFTER_CANDIDATE',transport:external.transport,basicAuth
  }),/F-LEGACY-CAPTURE:/);
 }
 assert.equal(external.calls.length,0);
});
test('F-LEGACY-CAPTURE does not silently accept HTML-like JSON or external redirect',async()=>{
 const bad=async()=>new Response('{"private":true}',{status:200,headers:{'content-type':'application/json'}});
 await assert.rejects(()=>captureLegacyHttpSnapshot({
  scope:'BEFORE_ORIGINAL',transport:bad
 }),/F-LEGACY-CAPTURE:/);
 const cross=async()=>new Response(null,{status:302,headers:{location:'https://external.example/private'}});
 const result=await captureLegacyHttpSnapshot({
  scope:'BEFORE_ORIGINAL',transport:cross
 });
 assert.equal(result.rows[0].redirectTo,null);
 assert.equal(result.rows[0].bodySha256,null);
 assert.equal(result.rows[0].status,302);
});
test('F-LEGACY-CAPTURE errors cannot contain page text, path or credential',async()=>{
 const transport=async()=>{throw Error('SECRET_BODY_AND_PASSWORD '+secret)};
 await assert.rejects(()=>captureLegacyHttpSnapshot({
  scope:'AFTER_CANDIDATE',basicAuth:auth,transport
 }),error=>{
  assert.match(error.message,/F-LEGACY-CAPTURE:/);
  assert.doesNotMatch(error.message,/SECRET_BODY|PASSWORD|correct-horse|en-us/);
  return true;
 });
});

test('F-LEGACY-CAPTURE stops at the first candidate authentication failure',async()=>{
 for(const denied of [401,403,407]){
  let requests=0;
  const transport=async (_url,init)=>{
   requests++;
   if(init.method==='HEAD'){
    assert.equal(init.headers.Authorization,undefined);
    return new Response(null,{status:401,headers:{
     'www-authenticate':'Basic realm="Imagine private review"'
    }});
   }
   assert.equal(init.headers.Authorization,auth);
   return new Response('SYNTHETIC_DENIED',{
    status:denied,headers:{'content-type':'text/plain'}
   });
  };
  await assert.rejects(()=>captureLegacyHttpSnapshot({
   scope:'AFTER_CANDIDATE',basicAuth:auth,transport
  }),error=>{
   assert.match(error.message,/^F-LEGACY-CAPTURE:/);
   assert.doesNotMatch(error.message,/SYNTHETIC_DENIED|correct-horse|Authorization/);
   return true;
  });
  assert.equal(requests,2,'HEAD challenge plus one denied GET; no further GETs');
 }
});
test('F-LEGACY-CAPTURE retains missing route evidence and public 401 as unproven',async()=>{
 const candidate=mockTransport({local:true,alterPath:'/en-us/termos-de-uso.html',alterStatus:404});
 const after=await captureLegacyHttpSnapshot({scope:'AFTER_CANDIDATE',
  basicAuth:auth,transport:candidate.transport});
 assert.equal(after.rows.length,27);
 assert.ok(after.rows.some(row=>row.status===404));
 let calls=0;
 const before=await captureLegacyHttpSnapshot({scope:'BEFORE_ORIGINAL',
  transport:async()=>{calls++;return new Response('SYNTHETIC_ORIGINAL_DENIED',{status:401});}});
 assert.equal(calls,27);
 assert.equal(before.rows.every(row=>row.status===401),true);
});

test('F310 candidate refuses an unprotected or unexpected localhost gate before credentials',async()=>{
 const cases=[
  {status:200,header:'',label:'open public-looking page'},
  {status:302,header:'',label:'redirect instead of private challenge'},
  {status:403,header:'',label:'denied without Basic challenge'},
  {status:407,header:'',label:'proxy authentication instead of staging'},
  {status:401,header:'',label:'401 with no challenge'},
  {status:401,header:'Basic realm="Unknown application"',label:'wrong realm'},
  {status:401,header:'Basic realm="Imagine private review", Basic realm="extra"',label:'ambiguous challenges'}
 ];
 for(const {status,header,label} of cases){
  const calls=[];
  const transport=async (url,init)=>{
   calls.push({url,init});
   assert.equal(init.method,'HEAD',label);
   assert.equal(init.headers.Authorization,undefined,label);
   return new Response(status===200?'SYNTHETIC_OPEN':null,{
    status,headers:header?{'www-authenticate':header}:{}
   });
  };
  await assert.rejects(()=>captureLegacyHttpSnapshot({
   scope:'AFTER_CANDIDATE',basicAuth:auth,transport
  }),/F-LEGACY-CAPTURE:/,label);
  assert.equal(calls.length,1,label+': no credential-bearing GET permitted');
  assert.equal(calls[0].url,candidateOrigin+'/',label);
 }
});
test('F310 anonymous staging HEAD challenge precedes first authenticated GET',async()=>{
 const seen=[];
 const transport=async (url,init)=>{
  seen.push({url,method:init.method,headers:init.headers});
  if(init.method==='HEAD')
   return new Response(null,{status:401,headers:{
    'www-authenticate':'Basic realm="Imagine private review"'
   }});
  return new Response('SYNTHETIC_CONTENT',{status:200,headers:{'content-type':'text/html'}});
 };
 const snapshot=await captureLegacyHttpSnapshot({
  scope:'AFTER_CANDIDATE',basicAuth:auth,transport
 });
 assert.equal(snapshot.rows.length,27);
 assert.equal(seen.length,28);
 assert.equal(seen[0].url,candidateOrigin+'/');
 assert.equal(seen[0].headers.Authorization,undefined);
 assert.ok(seen.slice(1).every(x=>x.method==='GET'&&x.headers.Authorization===auth));
});

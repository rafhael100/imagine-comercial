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
  assert.equal(init.method,'GET');
  assert.equal(init.redirect,'manual');
  assert.equal(init.credentials,'omit');
  assert.equal(init.headers.Authorization,local?auth:undefined);
  const path=url.slice(valid.length);
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
 assert.equal(afterMock.calls.length,27);
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

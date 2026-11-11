import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {request as httpRequest} from 'node:http';
import {startPrivateBudgetReviewLab} from './fixtures/private-budget-http-review-harness.mjs';
const password='SyntheticOnlyReviewPass_2026_NoSecrets';
const ids=[
  'bde4f010-aacf-4ad7-a302-94c507bb1111',
  'bde4f010-aacf-4ad7-a302-94c507bb2222',
  'bde4f010-aacf-4ad7-a302-94c507bb3333',
  'bde4f010-aacf-4ad7-a302-94c507bb4444',
  'bde4f010-aacf-4ad7-a302-94c507bb5555',
  'bde4f010-aacf-4ad7-a302-94c507bb6666'
];
function example(){
 const envelope={
  protocol:'imagine.lead-intake',schema_version:1,
  organization_reference:ids[0],binding_reference:ids[1],
  submission_reference:ids[2],site_reference:ids[3],
  form_reference:ids[4],destination_reference:ids[5]
 };
 return {
  privateDraft:{name:'Pessoa Fictícia',role:'',email:'lab@example.invalid',
   phone:'',mobile:'',serviceSlug:'onepage',
   details:'Demonstração fictícia sem contato real.',
   challengePreview:'5',previewUnderstanding:true},
  envelope,storedSnapshot:{original:envelope,phase:'open',version:0},expectedVersion:0
 };
}
test('P0 F161: authenticated local HTTP review never issues receipt or leaks fields',async()=>{
 const server=await startPrivateBudgetReviewLab(password);
 const url=new URL(server.url);
 const baseHeaders={
  'Host':url.host,'Origin':url.origin,
  'Content-Type':'application/json',
  'Authorization':'Basic '+Buffer.from('reviewer:'+password).toString('base64')
 };
 const request=(body,opts={})=>fetch(server.url,{
  method:'POST',headers:{...baseHeaders,...opts.headers},body,redirect:'manual'
 });
 try{
  const unauth=await fetch(server.url,{method:'POST',headers:{
   Host:url.host,Origin:url.origin,'Content-Type':'application/json'
  },body:JSON.stringify(example())});
  assert.equal(unauth.status,401);
  assert.equal((await unauth.json()).canSendToCrm,false);
  const res=await request(JSON.stringify(example()));
  assert.equal(res.status,200);
  const reply=await res.json();
  assert.equal(reply.mode,'LAB_DIAGNOSTIC_NOT_RECEIPT');
  assert.equal(reply.reasonCode,'ATOMIC_STORE_REQUIRED');
  assert.equal(reply.canSendToCrm,false);
  assert.equal(reply.canAcknowledgeVisitor,false);
  assert.equal(reply.canDeploy,false);
  assert.equal(res.headers.get('cache-control'),'private, no-store');
  assert.equal(res.headers.get('set-cookie'),null);
  for(const text of ['Pessoa Fictícia','lab@example.invalid','bde4f010-aacf-4ad7',
   'Demonstração fictícia'])assert.equal(JSON.stringify(reply).includes(text),false);

  const bad=example();bad.privateDraft.email='invalid';
  assert.equal((await (await request(JSON.stringify(bad))).json()).reasonCode,'INVALID_CONTACT_ROUTE');
  const stale=example();stale.expectedVersion=3;
  assert.equal((await (await request(JSON.stringify(stale))).json()).reasonCode,
    'STALE_SNAPSHOT_RECONCILE');
  assert.equal((await fetch(server.url,{method:'GET',headers:baseHeaders})).status,405);
  assert.equal((await request(JSON.stringify(example()),{headers:{Origin:'https://evil.invalid'}})).status,403);
  assert.equal((await request(JSON.stringify(example()),{headers:{'Content-Type':'text/plain'}})).status,415);
  assert.equal((await request('not-json')).status,400);
  assert.equal((await request('x'.repeat(5000))).status,413);
  // Undici/fetch may override Host with the target URL authority. Use
  // node:http directly to send a genuinely forged Host header.
  const hostileHost=await new Promise((resolve,reject)=>{
   const req=httpRequest(server.url,{
    method:'POST',headers:{...baseHeaders,Host:'evil.invalid'}
   },res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
   req.once('error',reject);
   req.end(JSON.stringify(example()));
  });
  assert.equal(hostileHost,421);
 }finally{await server.close();}
});
test('P0 F161: test-only server is not importable by Astro public pages',()=>{
 const code=readFileSync(new URL('./fixtures/private-budget-http-review-harness.mjs',import.meta.url),'utf8');
 assert.match(code,/server\.listen\(0,'127\.0\.0\.1'/);
 const astro=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
 assert.doesNotMatch(astro,/<form\b|<input\b|private-budget-http-review|fetch\s*\(/);
 assert.doesNotMatch(code,/\bwriteFile\s*\(|\bcreateWriteStream\s*\(/);
});

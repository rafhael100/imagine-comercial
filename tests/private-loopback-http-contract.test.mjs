import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startPrivateLoopbackIntakeHarness}
  from './fixtures/private-loopback-intake-harness.mjs';

const body=()=>({
  protocol:'imagine.lead-intake',schema_version:1,
  organization_reference:'11111111-1111-4111-8111-111111111111',
  binding_reference:'22222222-2222-4222-8222-222222222222',
  submission_reference:'33333333-3333-4333-8333-333333333333',
  site_reference:'44444444-4444-4444-8444-444444444444',
  form_reference:'55555555-5555-4555-8555-555555555555',
  destination_reference:'66666666-6666-4666-8666-666666666666'
});
const guardFlags=[
  'crmPersisted','tenantAuthenticatedForProduction',
  'visitorAcknowledgementAllowed','deliveryProven'
];

function post(h,data,{bearer=h.testOnlyBearer,contentType='application/json'}={}){
  return fetch(h.url,{
    method:'POST',
    headers:{
      'content-type':contentType,
      ...(bearer===null?{}:{authorization:'Bearer '+bearer})
    },
    body:typeof data==='string'?data:JSON.stringify(data),
    redirect:'error'
  });
}
async function inspect(response,status,code){
  assert.equal(response.status,status);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.match(response.headers.get('content-type'),/^application\/json/);
  const result=await response.json();
  assert.equal(result.mode,'LAB_ONLY_VOLATILE_NO_CRM_DELIVERY');
  assert.equal(result.reasonCode,code);
  assert.equal(result.schema,'imagine.comercial.loopback-intake-contract.v1');
  for(const flag of guardFlags)assert.equal(result[flag],false,flag);
  for(const val of [
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333'
  ])assert.ok(!JSON.stringify(result).includes(val));
}

test('F95: real HTTP loopback request remains untrusted and no durable CRM receipt',async t=>{
  const h=await startPrivateLoopbackIntakeHarness();
  t.after(()=>h.close());
  assert.match(h.url,/^http:\/\/127\.0\.0\.1:\d+\/__lab\/internal\/lead-review$/);
  assert.equal(h.recordedCount(),0);
  await inspect(await post(h,body()),202,'FIRST_SYNTHETIC_METADATA_OBSERVATION');
  assert.equal(h.recordedCount(),1);
  await inspect(await post(h,body()),202,'DUPLICATE_SYNTHETIC_METADATA');
  assert.equal(h.recordedCount(),1);
});

test('F95: two concurrent POSTs never create duplicate synthetic submissions',async t=>{
  const h=await startPrivateLoopbackIntakeHarness();
  t.after(()=>h.close());
  const [first,second]=await Promise.all([post(h,body()),post(h,body())]);
  const results=[await first.json(),await second.json()];
  assert.deepEqual(results.map(x=>x.reasonCode).sort(),[
    'DUPLICATE_SYNTHETIC_METADATA','FIRST_SYNTHETIC_METADATA_OBSERVATION'
  ]);
  assert.equal(h.recordedCount(),1);
  for(const x of results)for(const flag of guardFlags)assert.equal(x[flag],false);
});

test('F95: no metadata may bypass the ephemeral service token on loopback',async t=>{
  const h=await startPrivateLoopbackIntakeHarness();
  t.after(()=>h.close());
  await inspect(await post(h,body(),{bearer:null}),401,'SYNTHETIC_SERVICE_AUTH_REQUIRED');
  await inspect(await post(h,body(),{bearer:'incorrect-lab-token'}),401,
    'SYNTHETIC_SERVICE_AUTH_REQUIRED');
  assert.equal(h.recordedCount(),0);
});

test('F95: forbidden tenant and pinned destination are rejected even with test token',async t=>{
  const h=await startPrivateLoopbackIntakeHarness();
  t.after(()=>h.close());
  for(const key of [
    'organization_reference','binding_reference','site_reference',
    'form_reference','destination_reference'
  ]){
    const forged={...body(),[key]:'77777777-7777-4777-8777-777777777777'};
    await inspect(await post(h,forged),403,'UNTRUSTED_BINDING_CONTEXT');
  }
  assert.equal(h.recordedCount(),0);
});

test('F95: structured envelope is required and contact/consent fields cannot leak',async t=>{
  const h=await startPrivateLoopbackIntakeHarness();
  t.after(()=>h.close());
  for(const invalid of [
    {...body(),name:'Fictitious Person'},
    {...body(),email:'person@example.test'},
    {...body(),phone:'+5511999999999'},
    {...body(),consent:true},
    {...body(),protocol:'untrusted-protocol'},
    {...body(),schema_version:999},
    {...body(),submission_reference:'not-a-uuid'},
    {organization_reference:body().organization_reference}
  ])await inspect(await post(h,invalid),422,'METADATA_ENVELOPE_REJECTED');
  assert.equal(h.recordedCount(),0);
});

test('F95: request method, content-type, malformed JSON and bounded body fail closed',async t=>{
  const h=await startPrivateLoopbackIntakeHarness();
  t.after(()=>h.close());
  await inspect(await fetch(h.url,{method:'GET'}),404,'NO_PUBLIC_ROUTE');
  await inspect(await fetch(h.url+'?x=1',{method:'POST'}),404,'NO_PUBLIC_ROUTE');
  await inspect(await post(h,body(),{contentType:'text/plain'}),415,
    'JSON_CONTENT_TYPE_REQUIRED');
  await inspect(await post(h,'{"truncated":'),400,'INVALID_JSON');
  await inspect(await post(h,{...body(),unexpected:'x'.repeat(6000)}),413,
    'SYNTHETIC_BODY_LIMIT');
  assert.equal(h.recordedCount(),0);
});

test('F149: post-observation socket abort never becomes a successful HTTP acknowledgement',async t=>{
  const persisted=new Set();
  let abortOnce=true;
  const h=await startPrivateLoopbackIntakeHarness({
    observeMetadata:async data=>{
      const id=data.submission_reference;
      if(persisted.has(id))return 'duplicate';
      persisted.add(id);
      return 'new';
    },
    abortResponseAfterObservation:(_data,{existed})=>{
      if(!abortOnce)return false;
      assert.equal(existed,false);
      abortOnce=false;
      return true;
    }
  });
  t.after(()=>h.close());
  await assert.rejects(post(h,body()),{name:'TypeError'});
  assert.equal(persisted.size,1,'observer saw one synthetic event');
  await inspect(await post(h,body()),202,'DUPLICATE_SYNTHETIC_METADATA');
  assert.equal(persisted.size,1,'replay cannot create another observation');
  assert.equal(h.recordedCount(),0,'no in-memory F95 fallback');
});

test('F149: transport fault injection is forbidden without injected observer',async()=>{
  await assert.rejects(startPrivateLoopbackIntakeHarness({
    abortResponseAfterObservation:()=>true
  }),/response failure hook requires/);
  await assert.rejects(startPrivateLoopbackIntakeHarness({
    observeMetadata:async()=> 'new',
    abortResponseAfterObservation:'disconnect'
  }),/response failure hook requires/);
});

test('F95: harness lives only in tests, is not imported by Astro or published',()=>{
  const fixture=readFileSync(new URL('./fixtures/private-loopback-intake-harness.mjs',import.meta.url),'utf8');
  const page=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  const freeze=readFileSync(new URL('../src/lib/public-intake-freeze.mjs',import.meta.url),'utf8');
  assert.match(fixture,/server\.listen\(0,'127\.0\.0\.1'/);
  assert.match(fixture,/LAB_ONLY_VOLATILE_NO_CRM_DELIVERY/);
  assert.match(fixture,/randomBytes\(32\)/);
  assert.doesNotMatch(fixture,/0\.0\.0\.0|process\.env\.PORT|createWriteStream|localStorage|fetch\(/);
  assert.doesNotMatch(page,/private-loopback-intake-harness|<form\b|fetch\s*\(/);
  assert.match(freeze,/form element/);
});

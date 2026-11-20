import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_UNSUPPORTED_FALLBACK } from '../ops/faisca/openai/live-lab.mjs';
import { getGroundingSources } from '../ops/faisca/grounding/catalog.mjs';

const token = 'R85_PRIVATE_CATALOG_ALLOWLIST_TOKEN_2026';
const validSource = 'faisca.passage.onepage.description@r06-1';
const text = 'Um site Onepage reúne a apresentação comercial de uma empresa em uma página.';
const models = Object.freeze(['gpt-6-luna','gpt-6.1-terra']);

async function post(server) {
  return fetch(server.address + server.path, {
    method: 'POST',
    headers: { Authorization:'Bearer '+token, 'Content-Type':'application/json' },
    body: '{"caseId":"compare"}',
    redirect: 'error'
  });
}

test('R85 trusted pinned editorial sources are accepted and returned only as identifiers', async t => {
  const catalogIds = new Set(getGroundingSources().map(source => source.id));
  assert.equal(catalogIds.has(validSource), true);
  let calls = 0;
  const lab = {
    answer: async () => {
      calls++;
      return { status: 'draft_answer', text, sourceIds:[validSource], modelIds:models,
        publicReady:false, operationalEffects:false };
    },
    inspect: () => ({calls, externalModelInvocations:0})
  };
  const server = await startFaiscaOpenAIPrivateReview({lab, reviewToken:token});
  t.after(()=>server.close());
  const result=await post(server);
  assert.equal(result.status,200);
  const body=await result.json();
  assert.deepEqual(body.sources,[validSource]);
  assert.equal(body.publicReady,false);
  assert.equal(body.requiresEditorialReview,true);
  assert.equal(calls,1);
});

test('R85 arbitrary, misspelled, duplicated and unreviewed source IDs cannot masquerade as Imagine evidence', async t => {
  let sourceIds=[validSource], calls=0;
  const lab={
    answer:async()=>{calls++;return {status:'draft_answer', text, sourceIds, modelIds:models,
      publicReady:false, operationalEffects:false};},
    inspect:()=>({calls})
  };
  const server=await startFaiscaOpenAIPrivateReview({lab,reviewToken:token});
  t.after(()=>server.close());
  const invalid=[
    ['faisca.passage.unreviewed@r06-1'],
    ['faisca.passage.fixture@r06-1'],
    ['faisca.passage.onepage.description@r06-2'],
    ['faisca.passage.onepage.description'],
    ['fixture.editorial.source'],
    [validSource,validSource],
    [validSource,'faisca.passage.fake@r06-1'],
    []
  ];
  for(const item of invalid) {
    sourceIds=item;
    const response=await post(server);
    assert.equal(response.status,503,JSON.stringify(item));
    const body=await response.json();
    assert.deepEqual(body,{status:'unavailable',
      message:'The private AI review could not confirm a safe response.'});
    assert.doesNotMatch(JSON.stringify(body), /fixture|unreviewed|fake|description/);
  }
  assert.equal(calls,invalid.length,'Each rejected response has no automatic retry.');
  sourceIds=[validSource];
  const recovered=await post(server);
  assert.equal(recovered.status,200);
});

test('R85 sources with hostile own-data accessors are rejected without executing them', async t => {
  let reads=0;
  const sources=[validSource];
  Object.defineProperty(sources,'0',{enumerable:true,configurable:true,get(){
    reads++;throw Error('PRIVATE_SOURCE_CANARY');
  }});
  const lab={
    answer:async()=>({status:'draft_answer',text,sourceIds:sources,modelIds:models}),
    inspect:()=>({calls:1})
  };
  const server=await startFaiscaOpenAIPrivateReview({lab,reviewToken:token});
  t.after(()=>server.close());
  const result=await post(server);
  assert.equal(result.status,503);
  assert.equal(reads,0);
  assert.doesNotMatch(JSON.stringify(await result.json()), /PRIVATE_SOURCE_CANARY/);
});

test('R85 a host-fixed unsupported fallback remains valid without sources or paid-model provenance', async t => {
  const lab={
    answer:async()=>({status:'unsupported',
      text:FAISCA_OPENAI_UNSUPPORTED_FALLBACK,
      sourceIds:[],modelIds:[],publicReady:false,operationalEffects:false}),
    inspect:()=>({calls:0})
  };
  const server=await startFaiscaOpenAIPrivateReview({lab,reviewToken:token});
  t.after(()=>server.close());
  const result=await post(server);
  assert.equal(result.status,200);
  const body=await result.json();
  assert.equal(body.status,'unsupported');
  assert.deepEqual(body.sources,[]);
  assert.deepEqual(body.models,[]);
  assert.equal(body.publicReady,false);
});

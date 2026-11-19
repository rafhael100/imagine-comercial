import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_LIVE_LAB_SCHEMA, FAISCA_OPENAI_TEST_CASES } from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const bearer = 'R87_PRIVATE_SOURCE_BINDING_FIXTURE_2026';
const text = 'A Imagine apresenta soluções para objetivos diferentes. O escopo é confirmado na proposta.';
const modelIds = ['gpt-6-luna','gpt-6.1-terra'];

function reviewed(caseId) {
  const answerId = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES[caseId])
    .find(id => getGroundedAnswer(id)?.sources?.length);
  assert.ok(answerId, 'The pinned R06 catalog must contain a candidate for ' + caseId);
  return { schema: FAISCA_OPENAI_LIVE_LAB_SCHEMA, status:'draft_answer', answerId, text,
    sourceIds: getGroundedAnswer(answerId).sources.map(source => source.id),
    modelIds, publicReady:false, operationalEffects:false };
}

async function openServer(t, lab) {
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: bearer });
  t.after(() => server.close());
  return server;
}
function post(server, caseId='compare') {
  return fetch(server.address + server.path, { method:'POST', redirect:'error',
    headers:{ Authorization:'Bearer '+bearer, 'Content-Type':'application/json' },
    body:JSON.stringify({ caseId }) });
}

test('R87 real-shaped Luna/Terra answer must map exact ordered sources to selected reviewed recipe', async t => {
  let reply = reviewed('compare'), calls = 0;
  const lab = { answer:async()=>{calls++;return reply;}, inspect:()=>({calls}) };
  const server=await openServer(t, lab);
  for(const caseId of ['compare','process','pricing']) {
    reply=reviewed(caseId);
    const response=await post(server,caseId);
    assert.equal(response.status,200,caseId);
    const body=await response.json();
    assert.equal(body.sourceRecipeBound,true);
    assert.deepEqual(body.sources,reply.sourceIds);
    assert.equal(body.status,'draft_answer');
    assert.equal(body.requiresEditorialReview,true);
    assert.equal(body.publicReady,false);
  }
  assert.equal(calls,3);
});

test('R87 source allowlist alone is insufficient: reject another legitimate but unrelated source', async t => {
  const original=reviewed('compare');
  let reply=original, calls=0;
  const lab={answer:async()=>{calls++;return reply;},inspect:()=>({calls})};
  const server=await openServer(t,lab);
  const bad=[
    {...original,sourceIds:['faisca.passage.faq.precos@r06-1']},
    {...original,sourceIds:[...original.sourceIds,'faisca.passage.faq.precos@r06-1']},
    {...original,sourceIds:original.sourceIds.slice(0,-1)},
    {...original,sourceIds:[...original.sourceIds].reverse()},
    {...original,answerId:'unknown_review_recipe'},
    {...original,answerId:'channel_meta'},
    {...original,answerId:null},
    {...original,answerId:undefined},
    {...original,schema:'faisca.unreviewed-provider.v1'}
  ];
  for(const item of bad) {
    // Reversed single-source arrays cannot establish a mismatch;
    // all remaining invalid cases must still be checked.
    if(item.sourceIds?.length===1 && item.sourceIds[0]===original.sourceIds[0] &&
       item.answerId===original.answerId) continue;
    reply=item;
    const response=await post(server);
    assert.equal(response.status,503,JSON.stringify(item));
    const body=await response.json();
    assert.deepEqual(body,{status:'unavailable',
      message:'The private AI review could not confirm a safe response.'});
    assert.doesNotMatch(JSON.stringify(body), /faq\.precos|unknown_review_recipe|channel_meta/);
  }
  const noAnswerId={...original}; delete noAnswerId.answerId;
  reply=noAnswerId;
  assert.equal((await post(server)).status,503);
  reply=original;
  assert.equal((await post(server)).status,200,'A rejected reply does not poison the next synthetic review.');
});

test('R87 untrusted answerId accessors are rejected without executing their getter', async t => {
  let reads=0;
  const reply=reviewed('compare');
  Object.defineProperty(reply,'answerId',{enumerable:true,configurable:true,get(){
    reads++; throw Error('PRIVATE_MARKER');
  }});
  const lab={answer:async()=>reply,inspect:()=>({calls:1})};
  const server=await openServer(t,lab);
  const res=await post(server);
  assert.equal(res.status,503);
  assert.equal(reads,0);
  assert.doesNotMatch(JSON.stringify(await res.json()),/PRIVATE_MARKER/);
});

test('R87 legacy synthetic fixtures are not labelled as source-recipe-bound', async t => {
  const old=reviewed('compare');delete old.schema;delete old.answerId;
  const server=await openServer(t,{answer:async()=>old,inspect:()=>({calls:1})});
  const response=await post(server);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.sourceRecipeBound,false);
  assert.equal(body.requiresEditorialReview,true);
});

test('R87 real unsupported fallback cannot invent sources, model provenance or non-host text origin', async t => {
  let reply={schema:FAISCA_OPENAI_LIVE_LAB_SCHEMA,status:'unsupported',
    text:'Não consegui confirmar uma orientação pela IA neste teste privado. Consulte as informações oficiais da Imagine.',
    source:'host_fixed_fallback',sourceIds:[],modelIds:[],publicReady:false,operationalEffects:false};
  const server=await openServer(t,{answer:async()=>reply,inspect:()=>({calls:1})});
  let response=await post(server);
  assert.equal(response.status,200);
  assert.equal((await response.json()).sourceRecipeBound,false);
  for(const invalid of [
    {...reply,source:'provider_unreviewed'},
    {...reply,sourceIds:['faisca.passage.faq.precos@r06-1']},
    {...reply,modelIds:['gpt-6-luna','gpt-6.1-terra']},
    {...reply,answerId:'pricing'}
  ]) {
    reply=invalid;
    response=await post(server);
    assert.equal(response.status,503);
  }
});

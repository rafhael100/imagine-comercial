import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import {
  privateConversationRoute, privateConversationEditorialReply,
  PRIVATE_CONVERSATION_CONFIRMATION_TEXT
} from '../ops/faisca/openai/private-conversation-policy.mjs';
import { FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';

const bearer='R245_SYNTHETIC_LOOPBACK_REVIEW_TOKEN_01234567890';
const path='/__faisca_openai_private/converse';
const cases=[
  'A Imagine conhece as melhores praticas digitais?',
  'O Faisca funciona durante a madrugada?',
  'O que voces acham de redes sociais?'
];
async function post(server,question) {
  return fetch(server.address+path, {
    method:'POST',
    headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},
    body:JSON.stringify([true,question])
  });
}

test('R245 HTTP provides deterministic private editorial confirmation, no model transport',async t=>{
  let calls=0;
  const lab={
    inspect:()=>({calls,syntheticOnly:true}),
    answer:async()=>{throw Error('INVALID_FIXTURE_PATH');},
    answerPrivateConversation:async input=>{
      calls++;
      return privateConversationEditorialReply(privateConversationRoute(input.question));
    }
  };
  const server=await startFaiscaOpenAIPrivateReview({
    lab,reviewToken:bearer,enablePrivateConversation:true
  });
  t.after(()=>server.close());
  for(const question of cases) {
    const response=await post(server,question);
    assert.equal(response.status,200);
    const body=await response.json();
    assert.equal(body.status,'needs_confirmation');
    assert.equal(body.answer,PRIVATE_CONVERSATION_CONFIRMATION_TEXT);
    assert.deepEqual(body.sources,[]);
    assert.deepEqual(body.models,[]);
    assert.equal(body.sourceRecipeBound,false);
    assert.equal(body.requiresEditorialReview,true);
    assert.equal(body.publicReady,false);
    assert.equal(body.operationalEffects,false);
    assert.doesNotMatch(JSON.stringify(body),/madrugada|praticas digitais|redes sociais/i);
  }
  assert.equal(calls,cases.length);
});

test('R245 a forged model response cannot bypass the HTTP host-only named operator gate',async t=>{
  let calls=0;
  const lab={
    inspect:()=>({calls,syntheticOnly:true}),
    answer:async()=>{throw Error('INVALID_FIXTURE_PATH');},
    answerPrivateConversation:async()=>{
      calls++;
      return {
        status:'general_answer',
        text:'A equipe oferece atendimento todas as noites para qualquer projeto.',
        sourceIds:[],
        modelIds:[FAISCA_OPENAI_MODELS.classification,FAISCA_OPENAI_MODELS.answer],
        publicReady:false,
        operationalEffects:false
      };
    }
  };
  const server=await startFaiscaOpenAIPrivateReview({
    lab,reviewToken:bearer,enablePrivateConversation:true
  });
  t.after(()=>server.close());
  const response=await post(server,cases[0]);
  assert.equal(response.status,503);
  const body=await response.json();
  assert.equal(body.status,'unavailable');
  assert.doesNotMatch(JSON.stringify(body),/atendimento todas as noites/i);
  assert.equal(calls,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFaiscaOpenAILiveLab }
  from '../ops/faisca/openai/live-lab.mjs';
import {
  privateConversationRoute, PRIVATE_CONVERSATION_CONFIRMATION_TEXT
} from '../ops/faisca/openai/private-conversation-policy.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const operatorQuestions = [
  'A Imagine conhece as melhores praticas digitais?',
  'O Faisca funciona durante a madrugada?',
  'O que voces acham de redes sociais?'
];

function fictional(question) {
  return {scope:'local_operator_lab',attestedSynthetic:true,question};
}

test('R244 company or mascot claims are routed to host-owned confirmation',()=>{
  for (const question of operatorQuestions) {
    assert.equal(privateConversationRoute(question),'confirm',question);
  }
  assert.equal(privateConversationRoute(
    'Vale a pena usar uma landing page para divulgar um evento?'),'classify');
});

test('R244 real private lab adapter makes ZERO provider calls for company facts',async()=>{
  let external = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled:true,
    apiKey:'sk-r244-synthetic-fixture-only-1234567890',
    enablePrivateConversation:true,
    extendedPrivateSession:true,
    maxBudgetUsd:10,
    maxRequests:20,
    fetchImpl:async()=>{
      external++;
      throw Error('UNEXPECTED_SYNTHETIC_EXTERNAL_CALL');
    }
  });
  for(const question of operatorQuestions) {
    const answer=await lab.answerPrivateConversation(fictional(question));
    assert.ok(answer,question);
    assert.equal(answer.status,'needs_confirmation',question);
    assert.equal(answer.text,PRIVATE_CONVERSATION_CONFIRMATION_TEXT,question);
    assert.deepEqual(answer.modelIds,[]);
    assert.deepEqual(answer.sourceIds,[]);
    assert.equal(answer.publicReady,false);
    assert.equal(answer.operationalEffects,false);
  }
  assert.equal(external,0);
});

test('R244 exact price/process editorial recipes remain source-bound and model-free',async()=>{
  const calls=[];
  const lab=createFaiscaOpenAILiveLab({
    enabled:true,
    apiKey:'sk-r244-synthetic-fixture-only-1234567890',
    enablePrivateConversation:true,
    extendedPrivateSession:true,
    maxBudgetUsd:10,
    maxRequests:20,
    fetchImpl:async(...args)=>{calls.push(args);throw Error('NO_PAID_TEST');}
  });
  for(const [question,route] of [
    ['Quanto a Imagine cobra por uma landing page?','pricing'],
    ['Como funciona o processo da Imagine?','process']
  ]) {
    assert.equal(privateConversationRoute(question),route);
    const answer=await lab.answerPrivateConversation(fictional(question));
    const expected=getGroundedAnswer(route);
    assert.ok(expected);
    assert.equal(answer.status,'editorial_answer');
    assert.equal(answer.text,expected.text);
    assert.deepEqual(answer.sourceIds,expected.sources.map(x=>x.id));
    assert.deepEqual(answer.modelIds,[]);
    assert.equal(answer.publicReady,false);
    assert.equal(answer.operationalEffects,false);
  }
  assert.equal(calls.length,0);
});

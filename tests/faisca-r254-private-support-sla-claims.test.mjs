import test from 'node:test';
import assert from 'node:assert/strict';
import {
  privateConversationRoute, safePrivateGeneralReply,
  PRIVATE_CONVERSATION_CONFIRMATION_TEXT
} from '../ops/faisca/openai/private-conversation-policy.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS }
  from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview }
  from '../ops/faisca/openai/private-review-http.mjs';

const synthetic = question => ({
  scope:'local_operator_lab', attestedSynthetic:true, question
});
const general = 'Uma landing page pode organizar informações de serviços sem prometer resultados.';
const questions = Object.freeze([
  'Em quanto tempo o suporte responde?',
  'Qual o prazo do atendimento?',
  'Quando a equipe retorna uma mensagem?'
]);

test('R254 questions about operator support SLAs remain editorial and cost no paid requests',async()=>{
  let providerCalls=0;
  const lab=createFaiscaOpenAILiveLab({
    enabled:true, apiKey:'sk-r254-fixture-never-sent-1234567890',
    enablePrivateConversation:true, extendedPrivateSession:true,
    maxBudgetUsd:10,maxRequests:20,
    fetchImpl:async()=>{providerCalls++;throw Error('UNEXPECTED_PROVIDER');}
  });
  for(const question of questions){
    assert.equal(privateConversationRoute(question),'confirm',question);
    const answer=await lab.answerPrivateConversation(synthetic(question));
    assert.equal(answer.status,'needs_confirmation');
    assert.equal(answer.text,PRIVATE_CONVERSATION_CONFIRMATION_TEXT);
    assert.deepEqual(answer.modelIds,[]);
    assert.equal(answer.publicReady,false);
  }
  assert.equal(providerCalls,0);
  assert.equal(lab.inspect().calls,0);
  assert.equal(privateConversationRoute('Como melhorar a clareza de uma landing page?'),'classify');
});

test('R254 rejects invented SLAs and second-person service promises, not generic advice',()=>{
  const unsupported=[
    'Você terá suporte durante a campanha.',
    'Você receberá atendimento quando solicitar.',
    'Os clientes contarão com suporte da equipe.',
    'A equipe responde em até 15 minutos.',
    'O atendimento retorna em 2 horas.',
    'O suporte dá retorno dentro de 2 horas.',
    'O suporte funciona 24 horas.',
    'O atendimento acontece de segunda a sexta.'
  ];
  for(const text of unsupported){
    assert.equal(safePrivateGeneralReply(text),false,text);
  }
  for(const text of [
    'Uma landing page pode explicar como entrar em contato, sem definir horários.',
    'Uma seção de dúvidas pode orientar visitantes sobre atendimento digital.',
    'Você pode revisar o texto antes de publicá-lo.'
  ]) assert.equal(safePrivateGeneralReply(text),true,text);
});

test('R254 HTTP fails closed for unverified support SLA from injected synthetic adapter',async t=>{
  let unsafe=true;
  const lab={
    inspect:()=>({syntheticOnly:true}),
    answer:async()=>{throw Error('UNEXPECTED_CASE');},
    answerPrivateConversation:async()=>({
      status:'general_answer',
      text:unsafe?'A equipe responde em até 15 minutos.':
        'Uma seção de dúvidas pode orientar visitantes sobre atendimento digital.',
      sourceIds:[],
      modelIds:[FAISCA_OPENAI_MODELS.classification,FAISCA_OPENAI_MODELS.answer],
      publicReady:false,operationalEffects:false
    })
  };
  const token='R254_SYNTHETIC_PRIVATE_REVIEW_TOKEN_1234567890';
  const server=await startFaiscaOpenAIPrivateReview({
    lab,reviewToken:token,enablePrivateConversation:true
  });
  t.after(()=>server.close());
  const post=question=>fetch(server.address+'/__faisca_openai_private/converse',{
    method:'POST',redirect:'error',cache:'no-store',credentials:'omit',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify([true,question])
  });
  const blocked=await post('Como melhorar a clareza de uma landing page?');
  assert.equal(blocked.status,503);
  const raw=await blocked.text();
  assert.equal(JSON.parse(raw).status,'unavailable');
  assert.doesNotMatch(raw,/equipe|15 minutos|responde/i);
  assert.equal(blocked.headers.get('set-cookie'),null);
  assert.equal(blocked.headers.get('access-control-allow-origin'),null);
  unsafe=false;
  const routed=await post(questions[0]);
  assert.equal(routed.status,503);
  assert.equal((await routed.json()).status,'unavailable');
  const allowed=await post('Como melhorar a clareza de uma landing page?');
  assert.equal(allowed.status,200);
  assert.equal((await allowed.json()).status,'general_answer');
});

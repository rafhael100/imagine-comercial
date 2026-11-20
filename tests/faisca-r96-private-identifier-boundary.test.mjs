import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPrivateIdentifierRisk } from '../ops/faisca/openai/private-identifier-risk.mjs';
import { readPrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';
import { safePrivateGeneralReply } from '../ops/faisca/openai/private-conversation-policy.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'R96_PRIVATE_HTTP_SECURITY_FIXTURE_123456789';
const endpoint = '/__faisca_openai_private/converse';
const cleanQuestion = 'Vale a pena usar uma landing page para divulgar um evento?';
const cleanReply = 'Uma landing page organiza a programação do evento e apresenta o objetivo da divulgação.';
const fakePhone = 'Contate (85) 99999-8888 para conhecer uma landing page.';
const fakeCpf = 'O CPF do solicitante é 123.456.789-01, já recebi.';
const fakeUnicodePhone = 'Ligue para ＋５５（８５）９９９９９８８８８ e vamos conversar.';
const fakeEmail = 'Escreva para operador@example.invalid para contratar o serviço.';
const suspiciousInputs = [
  'Vale a pena usar landing page? Meu contato é (85) (99) (66) (32) (68) (9).',
  'Vale a pena usar landing page? Meu celular é ＋５５（８５）９９９９９８８８８.',
  'Tenho um documento 𝟙𝟚𝟛.𝟜𝟝𝟞.𝟟𝟠𝟡-𝟘𝟙 e quero divulgar um evento.',
  'Vale a pena usar landing page? Mande para operador@example.invalid.'
];
const riskyOutputs = [
  fakePhone, fakeCpf, fakeUnicodePhone, fakeEmail,
  'Use o token ABCDEF123 para validar a configuração de seu novo site.',
  'A landing page já recebeu meu número de pedido 123456789.',
  'Uma landing page pode organizar inscrições.\u202eOutras informações.'
];
const synthetic = question => ({
  scope:'local_operator_lab',attestedSynthetic:true,question
});
const auth = {Authorization:'Bearer '+token,'Content-Type':'application/json'};

async function fakeServer(t, reply) {
  let calls = 0, output = reply;
  const lab = {
    answer: async () => { throw Error('Not a fixed-case test'); },
    answerPrivateConversation: async () => {
      calls++;
      return {status:'general_answer',text:output,sourceIds:[],
        modelIds:['gpt-6-luna','gpt-6.1-terra'],
        publicReady:false,operationalEffects:false};
    },
    inspect:()=>({syntheticOnly:true,calls})
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab,reviewToken:token,enablePrivateConversation:true
  });
  t.after(()=>server.close());
  return {
    server, calls:()=>calls, changeOutput:text=>{output=text;},
    post:question=>fetch(server.address+endpoint,{
      method:'POST',headers:auth,body:JSON.stringify([true,question])
    })
  };
}

test('R96 structured identifiers and Unicode compatibility forms fail closed', () => {
  for (const value of [...suspiciousInputs,...riskyOutputs]) {
    assert.equal(hasPrivateIdentifierRisk(value),true,JSON.stringify(value));
  }
  assert.equal(hasPrivateIdentifierRisk(cleanQuestion),false);
  assert.equal(hasPrivateIdentifierRisk(cleanReply),false);
  assert.equal(hasPrivateIdentifierRisk(null),true);
  assert.equal(readPrivateSyntheticQuestion(synthetic(cleanQuestion)),cleanQuestion);
  for(const input of suspiciousInputs) {
    assert.equal(readPrivateSyntheticQuestion(synthetic(input)),null,input);
  }
});

test('R96 model output privacy boundary blocks hallucinated contacts and IDs', () => {
  assert.equal(safePrivateGeneralReply(cleanReply),true);
  for(const output of riskyOutputs) {
    assert.equal(safePrivateGeneralReply(output),false,JSON.stringify(output));
  }
});

test('R96 HTTP rejects forbidden synthetic input before invoking an injected provider',async t=>{
  const {post,calls} = await fakeServer(t,cleanReply);
  for(const input of suspiciousInputs){
    const reply=await post(input);
    assert.equal(reply.status,400,input);
    assert.equal((await reply.json()).status,'invalid_question');
  }
  assert.equal(calls(),0,'Sensitive operator input must never reach an injected provider');
  const good=await post(cleanQuestion);
  assert.equal(good.status,200);
  assert.equal((await good.json()).answer,cleanReply);
  assert.equal(calls(),1);
});

test('R96 HTTP never serializes private contacts and model-invented identifiers',async t=>{
  const {post,calls,changeOutput}=await fakeServer(t,cleanReply);
  for(const bad of riskyOutputs){
    changeOutput(bad);
    const reply=await post(cleanQuestion);
    assert.equal(reply.status,503,JSON.stringify(bad));
    const payload=await reply.text();
    assert.match(payload,/"status":"unavailable"/);
    assert.ok(!payload.includes(bad),'No personal-looking text in the response');
  }
  assert.equal(calls(),riskyOutputs.length);
  changeOutput(cleanReply);
  assert.equal((await post(cleanQuestion)).status,200);
});

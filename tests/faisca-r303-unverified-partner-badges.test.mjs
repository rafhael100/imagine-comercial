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

const questions = [
  'A agência é Google Partner?',
  'O serviço tem o selo Google Premier Partner?',
  'A plataforma é Meta Business Partner?',
  'A agência é parceira oficial do Google?',
  'O serviço é revendedor autorizado da OpenAI?',
  'A Meta credenciou a plataforma?'
];
const claims = [
  'A agência é Google Partner.',
  'O serviço tem o selo Google Premier Partner.',
  'A plataforma é Meta Business Partner.',
  'A agência é parceira oficial do Google.',
  'O serviço é revendedor autorizado da OpenAI.',
  'A Meta credenciou a plataforma.'
];
const neutral = 'Uma landing page pode explicar os serviços com clareza.';

test('R303 unverified partner badge questions use no model quota', async () => {
  let invocations = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-r303-FAKE-fixture-never-sent-1234567890',
    enablePrivateConversation: true, extendedPrivateSession: true,
    maxBudgetUsd: 10, maxRequests: 20,
    fetchImpl: async () => { invocations++; throw Error('UNEXPECTED_PROVIDER'); }
  });
  for (const question of questions) {
    assert.ok(['confirm','rejected'].includes(privateConversationRoute(question)), question);
    const result = await lab.answerPrivateConversation({
      scope:'local_operator_lab', attestedSynthetic:true, question
    });
    if (result !== null) {
      assert.equal(result.status,'needs_confirmation');
      assert.equal(result.text,PRIVATE_CONVERSATION_CONFIRMATION_TEXT);
      assert.deepEqual(result.modelIds,[]);
      assert.equal(result.publicReady,false);
      assert.equal(result.operationalEffects,false);
    }
  }
  assert.equal(invocations,0);
  assert.equal(lab.inspect().calls,0);
  assert.equal(privateConversationRoute('Como deixar uma landing page mais clara?'),'classify');
});

test('R303 fabricated partner accreditation are refused at egress', () => {
  for (const claim of claims) assert.equal(safePrivateGeneralReply(claim),false,claim);
  assert.equal(safePrivateGeneralReply(neutral),true);
});

test('R303 HTTP independently rejects unsupported partner assertions without echo', async t => {
  let reply = claims[0];
  const token = 'R303_SYNTHETIC_PRIVATE_REVIEW_TOKEN_ONLY_123456';
  const server = await startFaiscaOpenAIPrivateReview({
    lab: {
      inspect: () => ({syntheticOnly:true}),
      answer: async () => {throw Error('UNEXPECTED_FIXED_CASE');},
      answerPrivateConversation: async () => ({
        status:'general_answer', text:reply, sourceIds:[],
        modelIds:[FAISCA_OPENAI_MODELS.classification,FAISCA_OPENAI_MODELS.answer],
        publicReady:false, operationalEffects:false
      })
    },
    reviewToken:token, enablePrivateConversation:true
  });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method:'POST', redirect:'error', credentials:'omit', cache:'no-store',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify([true,'Como deixar uma landing page mais clara?'])
  });
  for (const claim of claims) {
    reply = claim;
    const response = await post();
    assert.equal(response.status,503,claim);
    const body = await response.text();
    assert.equal(JSON.parse(body).status,'unavailable');
    assert.equal(body.includes(claim),false);
    assert.equal(response.headers.get('set-cookie'),null);
    assert.equal(response.headers.get('access-control-allow-origin'),null);
  }
  reply = neutral;
  const response = await post();
  assert.equal(response.status,200);
  const result = await response.json();
  assert.equal(result.answer,neutral);
  assert.equal(result.publicReady,false);
  assert.equal(result.operationalEffects,false);
});

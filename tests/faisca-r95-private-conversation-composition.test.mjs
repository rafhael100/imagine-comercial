import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FAISCA_OPENAI_MODELS, createFaiscaOpenAILiveLab
} from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { inspectFaiscaPrivateReviewUi } from '../ops/faisca/openai/private-staging-readonly-smoke.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const bearer = 'R95_SYNTHETIC_PRIVATE_CONVERSATION_TOKEN_1234';
const generalQuestion = 'Vale a pena usar uma landing page para divulgar um evento?';
const priceQuestion = 'Quanto a Imagine cobra por uma landing page?';
const safeGeneral = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
const endpoint = '/__faisca_openai_private/converse';
const auth = { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' };

function response(model, payload) {
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{
      type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(payload) }]
    }],
    usage: { input_tokens: 200, output_tokens: 35 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
async function setup(t, { enabled = true, modelReply = safeGeneral } = {}) {
  const requests = [];
  const lab = createFaiscaOpenAILiveLab({
    enabled: true,
    apiKey: 'sk-r95-fixture-only-123456789012345',
    enablePrivateConversation: enabled,
    extendedPrivateSession: true,
    maxRequests: 20,
    maxBudgetUsd: 10,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const payload = JSON.parse(init.body);
      assert.equal(payload.store, false);
      assert.deepEqual(payload.tools, []);
      requests.push(payload);
      const out = payload.model === FAISCA_OPENAI_MODELS.classification
        ? { topic: 'general' } : { reply: modelReply };
      return response(payload.model, out);
    }
  });
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: bearer, enablePrivateConversation: enabled
  });
  t.after(() => server.close());
  return {
    lab, server, requests,
    post: (question, headers = auth) => fetch(server.address + endpoint, {
      method: 'POST', headers, body: JSON.stringify([true, question])
    })
  };
}

test('R95 default refuses arbitrary text and keeps reviewed R94 static UI unchanged', async t => {
  const { server, post, requests } = await setup(t, { enabled: false });
  const denied = await post(generalQuestion);
  assert.equal(denied.status, 404);
  assert.equal(requests.length, 0);
  const page = await (await fetch(server.address + '/__faisca_openai_private/review')).text();
  assert.doesNotMatch(page, /id="review-conversation"/);
  const smoke = await inspectFaiscaPrivateReviewUi({ origin: server.address });
  assert.equal(smoke.status, 'PRIVATE_UI_READONLY_VERIFIED');
  assert.equal(smoke.modelInvocations, 0);
  assert.equal(requests.length, 0);
});

test('R95 opted-in browser UI has only fictional operator fields and passes exact R94 smoke', async t => {
  const { server, requests } = await setup(t);
  const page = await (await fetch(server.address + '/__faisca_openai_private/review')).text();
  assert.match(page, /id="review-conversation"/);
  assert.match(page, /id="review-attestation"/);
  assert.match(page, /maxlength="240"/);
  const accepted = await inspectFaiscaPrivateReviewUi({
    origin: server.address, privateConversationEnabled: true
  });
  assert.equal(accepted.status, 'PRIVATE_UI_READONLY_VERIFIED');
  const oldMode = await inspectFaiscaPrivateReviewUi({ origin: server.address });
  assert.equal(oldMode.status, 'BLOCKED_PRIVATE_UI_NOT_VERIFIED');
  assert.equal(requests.length, 0);
});

test('R95 Luna and Terra answer a fictional general question via private loopback only', async t => {
  const { post, requests, server } = await setup(t);
  const reply = await post(generalQuestion);
  assert.equal(reply.status, 200);
  const value = await reply.json();
  assert.equal(value.status, 'general_answer');
  assert.equal(value.schema, 'faisca.openai-private-conversation-response.v1');
  assert.equal(value.sourceRecipeBound, false);
  assert.equal(value.answer, safeGeneral);
  assert.deepEqual(value.sources, []);
  assert.deepEqual(value.models, ['gpt-6-luna','gpt-6.1-terra']);
  assert.equal(value.publicReady, false);
  assert.equal(value.operationalEffects, false);
  assert.equal(value.requiresEditorialReview, true);
  assert.deepEqual(requests.map(x => x.model), ['gpt-6-luna','gpt-6.1-terra']);
  assert.equal(server.inspect().requests, 1);
});

test('R95 Imagine pricing remains exact approved editorial text, with zero model calls', async t => {
  const { post, requests } = await setup(t);
  const reply = await post(priceQuestion);
  assert.equal(reply.status, 200);
  const value = await reply.json();
  const approved = getGroundedAnswer('pricing');
  assert.ok(approved);
  assert.equal(value.status, 'editorial_answer');
  assert.equal(value.answer, approved.text);
  assert.deepEqual(value.sources, approved.sources.map(source => source.id));
  assert.deepEqual(value.models, []);
  assert.equal(value.sourceRecipeBound, true);
  assert.equal(value.operationalEffects, false);
  assert.equal(requests.length, 0);
});

test('R95 invalid sensitive or unauthorized input cannot dispatch an API call', async t => {
  const { post, requests, server } = await setup(t);
  for(const question of [
    'Meu pedido de pagamento foi aprovado?',
    'Meu email é pessoa@example.invalid e preciso de um Onepage.',
    'Qual o número do meu contrato?',
    'Minha chave de API é confidencial e quero uma Landing Page.'
  ]) {
    const result = await post(question);
    assert.equal(result.status, 400, question);
    assert.equal((await result.json()).status, 'invalid_question');
  }
  const unauthorized = await post(generalQuestion, {
    Authorization: 'Bearer WRONG_R95_SYNTHETIC_TOKEN_123456789',
    'Content-Type': 'application/json'
  });
  assert.equal(unauthorized.status, 403);
  const crossOrigin = await post(generalQuestion, { ...auth, Origin: 'https://example.invalid' });
  assert.equal(crossOrigin.status, 403);
  assert.equal(requests.length, 0);
  assert.equal(server.inspect().requests, 4); // invalid input is counted only after token validation
});

test('R95 forged editorial, fabricated company claims and model provenance are refused', async t => {
  const outcomes = [
    { status: 'editorial_answer',
      text: 'A Imagine cobra R$ 1 pela Landing Page sem precisar de proposta.',
      sourceIds: getGroundedAnswer('pricing').sources.map(x => x.id), modelIds: [] },
    { status: 'editorial_answer',
      text: getGroundedAnswer('pricing').text,
      sourceIds: getGroundedAnswer('process').sources.map(x => x.id), modelIds: [] },
    { status: 'general_answer',
      text: safeGeneral, sourceIds: [], modelIds: ['gpt-6-luna'] },
    { status: 'general_answer',
      text: 'A Imagine já confirmou a contratação automaticamente.',
      sourceIds: [], modelIds: ['gpt-6-luna','gpt-6.1-terra'] }
  ];
  let current = outcomes[0], calls = 0;
  const lab = {
    answer: async () => { throw Error('fixed cases not under test'); },
    answerPrivateConversation: async () => { calls++; return current; },
    inspect: () => ({ calls })
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: bearer, enablePrivateConversation: true
  });
  t.after(()=>server.close());
  for (let i=0; i<outcomes.length; i++) {
    current = outcomes[i];
    const path = i < 2 ? priceQuestion : generalQuestion;
    const res = await fetch(server.address + endpoint, {
      method:'POST',headers:auth,body:JSON.stringify([true,path])
    });
    assert.equal(res.status,503,'Invalid output index '+i);
    const json=await res.json();
    assert.equal(json.status,'unavailable');
    assert.doesNotMatch(JSON.stringify(json), /R\$ 1|confirmou a contratação/);
  }
  assert.equal(calls,outcomes.length);
});

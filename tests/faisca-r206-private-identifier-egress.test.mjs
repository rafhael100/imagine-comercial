import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const safe = 'Uma landing page pode apresentar informações sobre eventos com clareza.';
const bearer = 'R206_FICTIONAL_HTTP_REVIEW_TOKEN_ONLY_2026';
const unsafe = [
  'O CPF deve ser enviado antes de elaborar uma página de divulgação.',
  'O token e a senha devem ser compartilhados para ativar o serviço.',
  'Uma p\u0430gina pode apresentar os detalhes de um evento fictício.'
];

test('R206 loopback HTTP refuses private identifiers and homographs, keeps safe fictional advice', async t => {
  let reply = safe, fakeCalls = 0;
  const lab = {
    answer: async () => { throw new Error('No fixed case in this test'); },
    answerPrivateConversation: async () => {
      fakeCalls++;
      return {
        status: 'general_answer', text: reply, sourceIds: [],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra'],
        publicReady: false, operationalEffects: false
      };
    },
    inspect: () => ({ syntheticOnly: true, paidModelCalls: 0 })
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: bearer, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + bearer,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([true, question])
  });
  for (const candidate of unsafe) {
    reply = candidate;
    const response = await post();
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.status, 'unavailable');
    assert.doesNotMatch(JSON.stringify(body), /CPF|token e a senha|p\u0430gina/u);
  }
  reply = safe;
  const accepted = await post();
  assert.equal(accepted.status, 200);
  const body = await accepted.json();
  assert.equal(body.answer, safe);
  assert.equal(body.publicReady, false);
  assert.equal(body.operationalEffects, false);
  assert.equal(fakeCalls, unsafe.length + 1);
  assert.equal(server.inspect().requests, unsafe.length + 1);
  assert.equal(server.inspect().providerUnavailable, false);
});

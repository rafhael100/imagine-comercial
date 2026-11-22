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

const questions = Object.freeze([
  'A equipe atende aos sabados?',
  'Essa agencia faz reunioes por video?',
  'A agência está disponível para uma reunião?',
  'O assistente tem horario comercial?',
  'O chatbot presta orientacao aos domingos?',
  'Essa empresa oferece suporte aos visitantes?'
]);
const generalQuestion = 'Vale a pena usar uma landing page para divulgar um evento?';
const synthetic = question => ({
  scope: 'local_operator_lab', attestedSynthetic: true, question
});

test('R246 indirect operator/team/assistant questions never reach a topic model', async () => {
  let providerCalls = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true,
    apiKey: 'sk-r246-synthetic-fixture-only-1234567890',
    enablePrivateConversation: true,
    extendedPrivateSession: true,
    maxBudgetUsd: 10,
    maxRequests: 20,
    fetchImpl: async () => {
      providerCalls++;
      throw Error('UNEXPECTED_PROVIDER_CALL');
    }
  });
  for (const question of questions) {
    assert.equal(privateConversationRoute(question), 'confirm', question);
    const reply = await lab.answerPrivateConversation(synthetic(question));
    assert.ok(reply, question);
    assert.equal(reply.status, 'needs_confirmation');
    assert.equal(reply.text, PRIVATE_CONVERSATION_CONFIRMATION_TEXT);
    assert.deepEqual(reply.modelIds, []);
    assert.deepEqual(reply.sourceIds, []);
    assert.equal(reply.publicReady, false);
    assert.equal(reply.operationalEffects, false);
  }
  assert.equal(providerCalls, 0);
  assert.equal(lab.inspect().calls, 0);
  assert.equal(privateConversationRoute(generalQuestion), 'classify');
});

test('R246 model prose cannot masquerade as an unnamed operator', () => {
  for (const fabricated of [
    'A equipe atende aos sabados e oferece consultas gratuitas.',
    'Nossa agência pode atender os visitantes durante a madrugada.',
    'O assistente oferece atendimento comercial em todos os feriados.',
    'Essa empresa realiza reuniões a qualquer hora.'
  ]) {
    assert.equal(safePrivateGeneralReply(fabricated), false, fabricated);
  }
  assert.equal(safePrivateGeneralReply(
    'Uma landing page pode explicar os detalhes de um evento fictício.'
  ), true);
  assert.equal(safePrivateGeneralReply(
    'É possível organizar uma equipe de marketing com responsabilidades claras.'
  ), true);
});

test('R246 HTTP egress rejects forged team schedule without leaking model prose', async t => {
  let unsafe = true;
  const lab = {
    inspect: () => ({ syntheticOnly: true }),
    answer: async () => { throw Error('UNEXPECTED_FIXED_CASE'); },
    answerPrivateConversation: async () => ({
      status: 'general_answer',
      text: unsafe
        ? 'A equipe atende aos sabados e oferece consultas gratuitas.'
        : 'Uma landing page pode explicar os detalhes de um evento fictício.',
      sourceIds: [],
      modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
      operationalEffects: false, publicReady: false
    })
  };
  const reviewToken = 'R246_SYNTHETIC_OPERATOR_TOKEN_0123456789012345';
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', redirect: 'error', cache: 'no-store',
    headers: { Authorization: 'Bearer ' + reviewToken, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, generalQuestion])
  });
  const rejected = await post();
  assert.equal(rejected.status, 503);
  const rejectedBody = await rejected.text();
  assert.equal(JSON.parse(rejectedBody).status, 'unavailable');
  assert.doesNotMatch(rejectedBody, /consultas gratuitas|a equipe atende/i);
  assert.equal(rejected.headers.get('set-cookie'), null);
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
  unsafe = false;
  const allowed = await post();
  assert.equal(allowed.status, 200);
  const allowedBody = await allowed.json();
  assert.equal(allowedBody.status, 'general_answer');
  assert.equal(allowedBody.publicReady, false);
  assert.equal(allowedBody.operationalEffects, false);
});

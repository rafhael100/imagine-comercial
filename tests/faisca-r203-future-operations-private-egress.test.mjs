import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPrivateOperationalClaim, safePrivateGeneralReply
} from '../ops/faisca/openai/private-conversation-policy.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';

const negative = [
  'Vou publicar seu site ainda hoje.',
  'Vamos ativar sua campanha para você.',
  'Seu site será publicado hoje.',
  'Sua campanha vai ser ativada amanhã.',
  'Irei abrir um chamado para sua empresa.',
  'Vou gerar um pedido para você.'
];
const neutral = [
  'Você pode publicar uma página quando estiver pronta.',
  'Uma landing page ajuda a reunir informações essenciais de um evento.'
];
const token = 'R203_PRIVATE_SYNTHETIC_HTTP_REVIEW_TOKEN_12345678';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';

test('R203 rejects model promises of operational actions without blocking advice', () => {
  for (const text of negative) {
    assert.equal(hasPrivateOperationalClaim(text), true, text);
    assert.equal(safePrivateGeneralReply(text), false, text);
  }
  for (const text of neutral) {
    assert.equal(hasPrivateOperationalClaim(text), false, text);
    assert.equal(safePrivateGeneralReply(text), true, text);
  }
});

test('R203 private HTTP rejects invented future commitments with no output leak', async t => {
  let draft = negative[0], calls = 0;
  const lab = {
    answer: () => { throw new Error('fixed-case path not used'); },
    inspect: () => Object.freeze({ schema: 'r203-synthetic', publicReady: false, operationalEffects: false }),
    answerPrivateConversation: async () => {
      calls += 1;
      return {
        status: 'general_answer', text: draft, sourceIds: [],
        modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
        publicReady: false, operationalEffects: false
      };
    }
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, question])
  });
  for (const claim of negative) {
    draft = claim;
    const response = await post();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    const body = await response.text();
    assert.equal(JSON.parse(body).status, 'unavailable');
    assert.doesNotMatch(body, /publicar|campanha|chamado|pedido|R203_PRIVATE/i);
    assert.equal(server.inspect().providerUnavailable, false);
  }
  draft = neutral[0];
  const accepted = await post();
  assert.equal(accepted.status, 200);
  const body = await accepted.json();
  assert.equal(body.answer, neutral[0]);
  assert.deepEqual(body.sources, []);
  assert.equal(body.sourceRecipeBound, false);
  assert.equal(body.publicReady, false);
  assert.equal(body.operationalEffects, false);
  assert.equal(calls, negative.length + 1);
});

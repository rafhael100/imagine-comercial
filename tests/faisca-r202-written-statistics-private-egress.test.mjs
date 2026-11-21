import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPrivateUnsupportedOutcomeGuarantee, safePrivateGeneralReply
} from '../ops/faisca/openai/private-conversation-policy.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';

// Entire corpus is fabricated. Do not copy an analytics claim from user data.
const negative = [
  'Oitenta e três por cento dos visitantes preferem páginas curtas.',
  'Uma campanha simples trouxe dez novos leads por dia.',
  'A página gerou vinte e cinco inscrições em uma semana.',
  'Quatro em cada cinco visitantes escolhem uma landing page.',
  '80 em cada 100 usuários preferem sites com poucas seções.',
  'Em eventos, cerca de noventa por cento das inscrições são digitais.'
];
const neutral = [
  'Uma landing page pode apresentar informações principais de um evento de forma simples.',
  'Duas páginas podem atender objetivos de comunicação diferentes.'
];
const token = 'R202_PRIVATE_SYNTHETIC_HTTP_REVIEW_TOKEN_12345678';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';

test('R202 rejects written-out metrics and ratios without blocking neutral guidance', () => {
  for (const text of negative) {
    assert.equal(hasPrivateUnsupportedOutcomeGuarantee(text), true, text);
    assert.equal(safePrivateGeneralReply(text), false, text);
  }
  for (const text of neutral) {
    assert.equal(hasPrivateUnsupportedOutcomeGuarantee(text), false, text);
    assert.equal(safePrivateGeneralReply(text), true, text);
  }
});

test('R202 private HTTP rejects invented word-based statistics before sending browser response', async t => {
  let draft = negative[0], calls = 0;
  const lab = {
    answer: () => { throw new Error('fixed-case path not used'); },
    inspect: () => Object.freeze({ schema: 'r202-synthetic', publicReady: false, operationalEffects: false }),
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
    assert.doesNotMatch(body, /oitenta|leads|inscri|visitantes|landing page|R202_PRIVATE/i);
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

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';
import { hasPrivateUnsupportedOutcomeGuarantee } from '../ops/faisca/openai/private-conversation-policy.mjs';

const token = 'R137_SYNTHETIC_ONLY_REVIEW_BEARER_TOKEN_123456';
const fictionalQuestion = 'Uma landing page ajuda a divulgar eventos?';
const neutral = 'Uma landing page pode organizar informações gerais de um evento fictício.';

async function browserFixture(text, free) {
  let submit, requests = 0;
  const fields = new Map([
    ['review-token', { value: token }],
    ['review-case', { value: 'compare' }],
    ['review-conversation', {}],
    ['review-question', { value: free ? fictionalQuestion : '' }],
    ['review-attestation', { checked: free }],
    ['review-send', { disabled: false }],
    ['review-status', { textContent: '' }],
    ['review-answer', { textContent: '' }],
    ['review-sources', { textContent: '' }]
  ]);
  const data = {
    schema: free ? 'faisca.openai-private-conversation-response.v1'
      : 'faisca.openai-private-review-response.v1',
    status: free ? 'general_answer' : 'draft_answer',
    ...(free ? {} : { syntheticCaseId: 'compare' }),
    answer: text,
    sources: free ? [] : ['faisca.passage.onepage.description@r06-1'],
    models: ['gpt-6-luna', 'gpt-6.1-terra'],
    sourceRecipeBound: !free, requiresEditorialReview: true,
    publicReady: false, operationalEffects: false
  };
  vm.runInNewContext(PRIVATE_REVIEW_JS, {
    document: { getElementById(id) {
      if (id === 'faisca-review-form') return {
        addEventListener(name, callback) { if (name === 'submit') submit = callback; }
      };
      return fields.get(id);
    }},
    window: { addEventListener() {} },
    AbortController, TextDecoder, Uint8Array, Set, JSON, setTimeout, clearTimeout,
    fetch(path, options) {
      requests++;
      assert.equal(path, '/__faisca_openai_private/' + (free ? 'converse' : 'respond'));
      assert.equal(options.credentials, 'omit');
      assert.equal(options.headers.Authorization, 'Bearer ' + token);
      return Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
    }
  }, { filename: 'faisca-r137-browser.js', timeout: 1000 });
  await submit({ preventDefault() {} });
  return { requests, fields };
}

for (const claim of [
  'Garantimos vendas para qualquer campanha fictícia.',
  'O SEO garantirá primeira posição nos resultados.',
  'Prometemos resultados de anúncios.',
  'Uma campanha vai gerar 120 leads.',
  'Você terá 50 novos clientes.'
]) {
  test('R137: browser independently rejects unsupported result claim on both private paths', async () => {
    assert.equal(hasPrivateUnsupportedOutcomeGuarantee(claim), true, claim);
    for (const free of [false, true]) {
      const { requests, fields } = await browserFixture(claim, free);
      assert.equal(requests, 1, 'No retry after an untrusted 200 response');
      assert.equal(fields.get('review-answer').textContent, 'Resposta indisponível neste teste.');
      assert.equal(fields.get('review-sources').textContent, '', 'No false editorial citation');
      assert.equal(fields.get('review-token').value, '', 'No persisted bearer token');
      assert.equal(fields.get('review-send').disabled, false);
      assert.equal(fields.get('review-question').value, '');
    }
  });
}

test('R137: neutral fictional answer still renders in fixed and free review', async () => {
  assert.equal(hasPrivateUnsupportedOutcomeGuarantee(neutral), false);
  for (const free of [false, true]) {
    const { requests, fields } = await browserFixture(neutral, free);
    assert.equal(requests, 1);
    assert.equal(fields.get('review-answer').textContent, neutral);
    assert.equal(fields.get('review-token').value, '');
    assert.equal(fields.get('review-send').disabled, false);
    assert.equal(Boolean(fields.get('review-sources').textContent), !free);
  }
});

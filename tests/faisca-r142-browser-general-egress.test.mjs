import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';

const token = 'R142_BROWSER_PRIVATE_FIXTURE_TOKEN_1234567890';
const neutral = 'Uma landing page pode organizar informações de um evento e destacar como as pessoas podem participar.';

async function renderGeneralFixture(reply) {
  let submit, requests = 0;
  const fields = new Map([
    ['review-token', { value: token }],
    ['review-case', { value: 'compare' }],
    ['review-conversation', {}],
    ['review-question', { value: 'Vale a pena usar uma landing page para divulgar um evento?' }],
    ['review-attestation', { checked: true }],
    ['review-send', { disabled: false }],
    ['review-status', { textContent: '' }],
    ['review-answer', { textContent: '' }],
    ['review-sources', { textContent: '' }]
  ]);
  vm.runInNewContext(PRIVATE_REVIEW_JS, {
    document: { getElementById(id) {
      if (id === 'faisca-review-form') return {
        addEventListener(name, handler) { if (name === 'submit') submit = handler; }
      };
      return fields.get(id);
    } },
    window: { addEventListener() {} },
    AbortController, TextDecoder, Uint8Array, Set, JSON, setTimeout, clearTimeout,
    fetch(path, options) {
      requests++;
      assert.equal(path, '/__faisca_openai_private/converse');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.headers.Authorization, 'Bearer ' + token);
      return Promise.resolve(new Response(JSON.stringify({
        schema: 'faisca.openai-private-conversation-response.v1',
        status: 'general_answer', answer: reply, sources: [],
        models: ['gpt-6-luna', 'gpt-6.1-terra'],
        sourceRecipeBound: false, requiresEditorialReview: true,
        publicReady: false, operationalEffects: false
      }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }));
    }
  }, { filename: 'faisca-r142-browser.js', timeout: 1000 });
  assert.equal(typeof submit, 'function');
  await submit({ preventDefault() {} });
  return { fields, requests };
}

for (const claim of [
  'A Imagine oferece pacotes para eventos fictícios.',
  'O preço para esta página imaginária é R$ 499 mensais.',
  'Publicamos uma campanha fictícia de divulgação hoje.',
  'Nós cobramos mensalidades para qualquer página imaginária.'
]) {
  test('R142: independent private browser rejects unreviewed general business claim', async () => {
    const { fields, requests } = await renderGeneralFixture(claim);
    assert.equal(requests, 1, 'Never retry paid provider calls on unsafe egress');
    assert.equal(fields.get('review-answer').textContent, 'Resposta indisponível neste teste.');
    assert.equal(fields.get('review-sources').textContent, '');
    assert.equal(fields.get('review-token').value, '');
    assert.equal(fields.get('review-question').value, '');
    assert.equal(fields.get('review-send').disabled, false);
  });
}

test('R142: valid purely general Luna/Terra response remains visible without citations', async () => {
  const { fields, requests } = await renderGeneralFixture(neutral);
  assert.equal(requests, 1);
  assert.equal(fields.get('review-answer').textContent, neutral);
  assert.equal(fields.get('review-sources').textContent, '');
  assert.equal(fields.get('review-token').value, '');
  assert.equal(fields.get('review-question').value, '');
  assert.equal(fields.get('review-send').disabled, false);
});

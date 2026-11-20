import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';

const privateToken = 'R90_SYNTHETIC_BROWSER_TOKEN_1234567890';
const approved = Object.freeze({
  schema: 'faisca.openai-private-review-response.v1',
  status: 'draft_answer', syntheticCaseId: 'compare',
  answer: 'A Imagine orienta a diferença entre Onepage e Landing Page a partir de conteúdo editorial revisado.',
  sources: ['faisca.passage.onepage.description@r06-1'],
  models: ['gpt-6-luna','gpt-6.1-terra'], sourceRecipeBound: true,
  requiresEditorialReview: true, publicReady: false, operationalEffects: false
});

async function simulatedPrivateBrowser(payload) {
  let submit, calls = 0;
  const elements = new Map([
    ['review-token', { value: privateToken }],
    ['review-case', { value: 'compare' }],
    ['review-send', { disabled: false }],
    ['review-status', { textContent: '' }],
    ['review-answer', { textContent: '' }],
    ['review-sources', { textContent: '' }]
  ]);
  const context = {
    document: {
      getElementById(id) {
        if (id === 'faisca-review-form') return {
          addEventListener(name, cb) { if (name === 'submit') submit = cb; }
        };
        return elements.get(id);
      }
    },
    window: { addEventListener() {} },
    AbortController, TextDecoder, Uint8Array, Set, JSON,
    setTimeout, clearTimeout,
    async fetch(url, options) {
      calls++;
      assert.equal(url, '/__faisca_openai_private/respond');
      assert.equal(options.method, 'POST');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      assert.equal(options.signal instanceof AbortSignal, true);
      assert.equal(options.headers.Authorization, 'Bearer ' + privateToken);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  };
  vm.runInNewContext(PRIVATE_REVIEW_JS, context, { timeout: 1000, filename: 'faisca-private-ui.js' });
  assert.equal(typeof submit, 'function');
  await submit({ preventDefault() {} });
  assert.equal(calls, 1);
  assert.equal(elements.get('review-token').value, '');
  assert.equal(elements.get('review-send').disabled, false);
  return Object.fromEntries([...elements].map(([key, value]) =>
    [key, value.textContent ?? value.value]));
}

test('R90 bounded browser reader still displays an explicitly source-recipe-bound fixture as plain text', async () => {
  const result = await simulatedPrivateBrowser(approved);
  assert.equal(result['review-answer'], approved.answer);
  assert.match(result['review-sources'], /faisca.passage.onepage.description/);
  assert.match(result['review-status'], /Revisão editorial obrigatória/);
});

test('R90 browser fails closed on oversized body, duplicate sources, extra sources or control characters', async () => {
  const invalid = [
    { ...approved, ignoredPayload: 'Z'.repeat(20000) },
    { ...approved, sources: Array(13).fill(approved.sources[0]) },
    { ...approved, sources: [approved.sources[0], approved.sources[0]] },
    { ...approved, sources: ['unreviewed<id>'] },
    { ...approved, answer: 'Texto\nde teste com controle proibido e extensão adequada.' }
  ];
  for (const reply of invalid) {
    const result = await simulatedPrivateBrowser(reply);
    assert.equal(result['review-answer'], 'Resposta indisponível neste teste.');
    assert.equal(result['review-sources'], '');
    assert.match(result['review-status'], /não concluiu/);
  }
});

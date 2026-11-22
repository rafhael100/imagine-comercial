import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';
import { reviewedFixedReceiptSources } from './faisca-r211-fixed-receipt-fixture.mjs';

const TOKEN = 'R116_SYNTHETIC_OPERATOR_REVIEW_TOKEN_1234';

async function runBrowserSubmit(fetchImpl) {
  let submit, calls = 0, cancelObserved = false;
  const elements = new Map([
    ['review-token', { value: TOKEN }],
    ['review-case', { value: 'compare' }],
    ['review-send', { disabled: false }],
    ['review-status', { textContent: '' }],
    ['review-answer', { textContent: '' }],
    ['review-sources', { textContent: '' }]
  ]);
  const context = {
    document: { getElementById(id) {
      if (id === 'faisca-review-form') return {
        addEventListener(event, callback) { if (event === 'submit') submit = callback; }
      };
      return elements.get(id);
    }},
    window: { addEventListener() {} },
    AbortController, TextDecoder, Uint8Array, Set, JSON,
    setTimeout(callback, ms) {
      // Make only the 35s browser deadline short in a deterministic synthetic test.
      return setTimeout(callback, ms === 35000 ? 20 : ms);
    },
    clearTimeout,
    fetch(url, options) {
      calls++;
      assert.equal(url, '/__faisca_openai_private/respond');
      assert.equal(options.method, 'POST');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer ' + TOKEN);
      assert.equal(options.signal instanceof AbortSignal, true);
      options.signal.addEventListener('abort', () => { cancelObserved = true; }, { once: true });
      return fetchImpl(url, options);
    }
  };
  vm.runInNewContext(PRIVATE_REVIEW_JS, context, { filename: 'faisca-r116-browser.js', timeout: 1000 });
  assert.equal(typeof submit, 'function');
  let guard;
  try {
    await Promise.race([
      submit({ preventDefault() {} }),
      new Promise((_, reject) => {
        guard = setTimeout(() => reject(new Error('Private submit did not release UI')), 800);
      })
    ]);
  } finally {
    clearTimeout(guard);
  }
  return { calls, cancelObserved, elements };
}

test('R116 fetch that ignores AbortSignal cannot hold the private UI indefinitely', async () => {
  const result = await runBrowserSubmit(() => new Promise(() => {}));
  assert.equal(result.calls, 1, 'No hidden retries or loops');
  assert.equal(result.cancelObserved, true, 'AbortSignal still sent to transport');
  assert.equal(result.elements.get('review-token').value, '', 'Transient bearer is erased');
  assert.equal(result.elements.get('review-send').disabled, false, 'Operator recovers control');
  assert.equal(result.elements.get('review-answer').textContent,
    'Resposta indisponível neste teste.');
  assert.match(result.elements.get('review-status').textContent, /não concluiu/);
});

test('R116 success continues to use normal read/provenance rules and textContent', async () => {
  const data = {
    schema: 'faisca.openai-private-review-response.v1',
    status: 'draft_answer', syntheticCaseId: 'compare',
    answer: 'O Onepage apresenta serviços e a Landing Page destaca uma oferta específica.',
    sources: reviewedFixedReceiptSources('compare'),
    models: ['gpt-6-luna', 'gpt-6.1-terra'],
    sourceRecipeBound: true, requiresEditorialReview: true,
    publicReady: false, operationalEffects: false
  };
  const result = await runBrowserSubmit(() => new Response(JSON.stringify(data), {
    status: 200, headers: { 'content-type': 'application/json' }
  }));
  assert.equal(result.calls, 1);
  assert.equal(result.cancelObserved, false);
  assert.equal(result.elements.get('review-answer').textContent, data.answer);
  assert.match(result.elements.get('review-sources').textContent, /faisca\.passage/);
  assert.equal(result.elements.get('review-send').disabled, false);
  assert.equal(result.elements.get('review-token').value, '');
});

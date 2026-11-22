import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';
import { reviewedFixedReceiptSources } from './faisca-r211-fixed-receipt-fixture.mjs';

const TOKEN = 'R131_SYNTHETIC_PRIVATE_BROWSER_BEARER_1234567';
const safeQuestion = 'Qual a finalidade de um site fictício para uma empresa fictícia?';
const safeAnswer = 'Um site institucional pode explicar os serviços de uma empresa fictícia.';

async function runPrivateFixture({ question = '', reply = safeAnswer } = {}) {
  let submit, fetches = 0;
  const isFree = Boolean(question);
  const fields = new Map([
    ['review-token', { value: TOKEN }],
    ['review-case', { value: 'compare' }],
    ['review-conversation', {}],
    ['review-question', { value: question }],
    ['review-attestation', { checked: isFree }],
    ['review-send', { disabled: false }],
    ['review-status', { textContent: '' }],
    ['review-answer', { textContent: '' }],
    ['review-sources', { textContent: '' }]
  ]);
  const fixedResponse = {
    schema: 'faisca.openai-private-review-response.v1',
    status: 'draft_answer', syntheticCaseId: 'compare',
    answer: reply,
    sources: reviewedFixedReceiptSources('compare'),
    models: ['gpt-6-luna', 'gpt-6.1-terra'],
    sourceRecipeBound: true, requiresEditorialReview: true,
    publicReady: false, operationalEffects: false
  };
  vm.runInNewContext(PRIVATE_REVIEW_JS, {
    document: { getElementById(id) {
      if (id === 'faisca-review-form') {
        return { addEventListener(name, callback) {
          if (name === 'submit') submit = callback;
        }};
      }
      return fields.get(id);
    }},
    window: { addEventListener() {} },
    AbortController, TextDecoder, Uint8Array, Set, JSON, setTimeout, clearTimeout,
    fetch(url, options) {
      fetches++;
      assert.equal(url, '/__faisca_openai_private/' + (isFree ? 'converse' : 'respond'));
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer ' + TOKEN);
      if (isFree) assert.equal(options.body, JSON.stringify([true, question]));
      return Promise.resolve(new Response(JSON.stringify(fixedResponse), {
        status: isFree ? 503 : 200, headers: { 'content-type': 'application/json' }
      }));
    }
  }, { filename: 'faisca-r131-private-browser.js', timeout: 1000 });
  assert.equal(typeof submit, 'function');
  await submit({ preventDefault() {} });
  return { fetches, fields };
}

for (const marker of ['\u00ad', '\ufeff', '\u2066', '\u200d', '\u034f']) {
  test('R131 never sends an operator question with invisible Unicode ' +
       JSON.stringify(marker), async () => {
    const question = 'Quero um site fictício para ' + marker + ' uma loja imaginária.';
    const { fetches, fields } = await runPrivateFixture({ question });
    assert.equal(fetches, 0, 'Preflight must reject before HTTP');
    assert.equal(fields.get('review-token').value, '');
    assert.equal(fields.get('review-question').value, '');
    assert.equal(fields.get('review-attestation').checked, false);
    assert.equal(fields.get('review-send').disabled, false);
    assert.match(fields.get('review-status').textContent, /fictícia/);
  });

  test('R131 never displays a model claim concealed by invisible Unicode ' +
       JSON.stringify(marker), async () => {
    const reply = 'Seu site já está ' + marker + ' no ar e pode receber visitantes.';
    const { fetches, fields } = await runPrivateFixture({ reply });
    assert.equal(fetches, 1, 'No paid retry');
    assert.equal(fields.get('review-answer').textContent, 'Resposta indisponível neste teste.');
    assert.equal(fields.get('review-sources').textContent, '');
    assert.equal(fields.get('review-token').value, '');
    assert.equal(fields.get('review-send').disabled, false);
  });
}

test('R131 preserves clean operator text and a safe fictional editorial reply', async () => {
  const free = await runPrivateFixture({ question: safeQuestion });
  assert.equal(free.fetches, 1);
  assert.equal(free.fields.get('review-question').value, '');
  const fixed = await runPrivateFixture();
  assert.equal(fixed.fetches, 1);
  assert.equal(fixed.fields.get('review-answer').textContent, safeAnswer);
  assert.match(fixed.fields.get('review-sources').textContent, /faisca\.passage/);
});

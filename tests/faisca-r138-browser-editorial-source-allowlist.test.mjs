import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';
import { getGroundingSources } from '../ops/faisca/grounding/catalog.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const goodId = 'faisca.passage.onepage.description@r06-1';
const inventedId = 'faisca.passage.imaginary-sale@r06-1';
const neutral = 'Uma página fictícia pode apresentar informações gerais de um serviço.';
const editorial = getGroundedAnswer('pricing');

async function submitSyntheticResponse({ free, sourceId, answerText = free ? editorial.text : neutral }) {
  let submit;
  let calls = 0;
  const fields = new Map([
    ['review-token', { value: 'R138_SYNTHETIC_OPERATOR_REVIEW_TOKEN_123456789' }],
    ['review-case', { value: 'compare' }],
    ['review-conversation', {}],
    ['review-question', { value: free ? 'Como organizar uma oferta fictícia?' : '' }],
    ['review-attestation', { checked: free }],
    ['review-send', { disabled: false }],
    ['review-status', { textContent: '' }],
    ['review-answer', { textContent: '' }],
    ['review-sources', { textContent: '' }]
  ]);
  const response = {
    schema: free ? 'faisca.openai-private-conversation-response.v1'
      : 'faisca.openai-private-review-response.v1',
    status: free ? 'editorial_answer' : 'draft_answer',
    ...(free ? {} : { syntheticCaseId: 'compare' }),
    answer: answerText,
    sources: [sourceId],
    models: free ? [] : ['gpt-6-luna', 'gpt-6.1-terra'],
    sourceRecipeBound: true,
    requiresEditorialReview: true,
    publicReady: false,
    operationalEffects: false
  };
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
      calls++;
      assert.equal(path, '/__faisca_openai_private/' + (free ? 'converse' : 'respond'));
      assert.equal(options.credentials, 'omit');
      return Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
    }
  }, { filename: 'faisca-r138-private-browser.js', timeout: 1000 });
  assert.equal(typeof submit, 'function');
  await submit({ preventDefault() {} });
  return { calls, fields };
}

test('R138: browser editorial whitelist comes from pinned R06 sources', () => {
  const ids = getGroundingSources().map(source => source.id);
  assert.ok(ids.includes(goodId));
  assert.ok(!ids.includes(inventedId));
});

for (const free of [false, true]) {
  test('R138: reject an invented but syntactically valid citation in ' +
    (free ? 'free editorial' : 'fixed') + ' HTTP 200', async () => {
    const { calls, fields } = await submitSyntheticResponse({ free, sourceId: inventedId });
    assert.equal(calls, 1, 'No automatic repeat or new API charge');
    assert.equal(fields.get('review-answer').textContent, 'Resposta indisponível neste teste.');
    assert.equal(fields.get('review-sources').textContent, '');
    assert.equal(fields.get('review-token').value, '');
    assert.equal(fields.get('review-question').value, '');
    assert.equal(fields.get('review-send').disabled, false);
  });
  test('R138: approved editorial ID remains displayable in ' +
    (free ? 'free editorial' : 'fixed') + ' synthetic fixture', async () => {
    const approvedId = free ? editorial.sources[0].id : goodId;
    const { calls, fields } = await submitSyntheticResponse({ free, sourceId: approvedId });
    assert.equal(calls, 1);
    assert.equal(fields.get('review-answer').textContent, free ? editorial.text : neutral);
    assert.ok(fields.get('review-sources').textContent.includes(approvedId));
    assert.equal(fields.get('review-token').value, '');
    assert.equal(fields.get('review-send').disabled, false);
  });
}

test('R139: browser rejects invented editorial prose even with approved citation and receipt flag', async () => {
  const { calls, fields } = await submitSyntheticResponse({
    free: true, sourceId: editorial.sources[0].id, answerText: neutral
  });
  assert.equal(calls, 1);
  assert.equal(fields.get('review-answer').textContent, 'Resposta indisponível neste teste.');
  assert.equal(fields.get('review-sources').textContent, '');
  assert.equal(fields.get('review-token').value, '');
  assert.equal(fields.get('review-send').disabled, false);
});

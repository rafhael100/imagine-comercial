import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';
import { getGroundingSources } from '../ops/faisca/grounding/catalog.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';
import { PRIVATE_CONVERSATION_CONFIRMATION_TEXT } from '../ops/faisca/openai/private-conversation-policy.mjs';

const goodId = 'faisca.passage.onepage.description@r06-1';
const inventedId = 'faisca.passage.imaginary-sale@r06-1';
const neutral = 'Uma página fictícia pode apresentar informações gerais de um serviço.';
const editorial = getGroundedAnswer('pricing');

async function submitSyntheticResponse({ free, sourceId, answerText = free ? editorial.text : neutral, responseStatus }) {
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
  const confirmation = responseStatus === 'needs_confirmation';
  const response = {
    schema: free ? 'faisca.openai-private-conversation-response.v1'
      : 'faisca.openai-private-review-response.v1',
    status: responseStatus ?? (free ? 'editorial_answer' : 'draft_answer'),
    ...(free ? {} : { syntheticCaseId: 'compare' }),
    answer: answerText,
    sources: confirmation ? [] : [sourceId],
    models: free ? [] : ['gpt-6-luna', 'gpt-6.1-terra'],
    sourceRecipeBound: !confirmation,
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
      return Promise.resolve(new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }));
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


test('R140: pinned R06 recipe keeps literal LF without allowing CRLF substitution', async () => {
  assert.ok(editorial.text.includes('\n'), 'Approved editorial text has LF separators');
  const { calls, fields } = await submitSyntheticResponse({
    free: true, sourceId: editorial.sources[0].id,
    answerText: editorial.text.replace(/\n/g, '\r\n')
  });
  assert.equal(calls, 1);
  assert.equal(fields.get('review-answer').textContent, 'Resposta indisponível neste teste.');
  assert.equal(fields.get('review-sources').textContent, '');
  assert.equal(fields.get('review-token').value, '');
});

test('R140: unreviewed additional LF does not bypass exact receipt binding', async () => {
  const { calls, fields } = await submitSyntheticResponse({
    free: true, sourceId: editorial.sources[0].id,
    answerText: editorial.text + '\n'
  });
  assert.equal(calls, 1);
  assert.equal(fields.get('review-answer').textContent, 'Resposta indisponível neste teste.');
  assert.equal(fields.get('review-sources').textContent, '');
  assert.equal(fields.get('review-token').value, '');
});

test('R141: host-pinned needs_confirmation remains displayable without citations or models', async () => {
  const { calls, fields } = await submitSyntheticResponse({
    free: true, responseStatus: 'needs_confirmation',
    answerText: PRIVATE_CONVERSATION_CONFIRMATION_TEXT
  });
  assert.equal(calls, 1);
  assert.equal(fields.get('review-answer').textContent, PRIVATE_CONVERSATION_CONFIRMATION_TEXT);
  assert.equal(fields.get('review-sources').textContent, '');
  assert.equal(fields.get('review-token').value, '');
  assert.equal(fields.get('review-send').disabled, false);
});

test('R141: a local HTTP 200 cannot forge a host confirmation even with valid envelope', async () => {
  const { calls, fields } = await submitSyntheticResponse({
    free: true, responseStatus: 'needs_confirmation',
    answerText: 'A Imagine confirmou uma condição comercial exclusiva para este exemplo fictício.'
  });
  assert.equal(calls, 1, 'No retry or extra API dispatch');
  assert.equal(fields.get('review-answer').textContent, 'Resposta indisponível neste teste.');
  assert.equal(fields.get('review-sources').textContent, '');
  assert.equal(fields.get('review-token').value, '');
  assert.equal(fields.get('review-send').disabled, false);
});

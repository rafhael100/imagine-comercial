import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { hasPrivateIdentifierRisk } from '../ops/faisca/openai/private-identifier-risk.mjs';
import { readPrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';
import {
  createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS, FAISCA_OPENAI_TEST_CASES
} from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';

// Fictional strings only. Never decode, echo, persist or send them to a provider.
const encoded = [
  'pessoa%40exemplo%2einvalid',
  'https%3A%2F%2Fexemplo.invalid',
  'nome%u0040exemplo',
  'nome&#64;exemplo',
  'nome&#x40;exemplo',
  'nome&commat;exemplo',
  'nome\\u0040exemplo',
  'nome\\x40exemplo',
  'nome\\u{40}exemplo'
];
const benignQuestion = 'Como estruturar uma landing page para um evento fictício?';
const benignReply = 'Uma landing page pode apresentar informações gerais sobre um evento fictício.';
const wrap = marker => 'Como explicar ' + marker + ' para uma loja de demonstração fictícia?';

test('R152 encoded aliases never bypass the host synthetic input/output gate', () => {
  for (const marker of encoded) {
    const question = wrap(marker);
    assert.equal(hasPrivateIdentifierRisk(question), true, 'encoded input blocked');
    assert.equal(hasPrivateIdentifierRisk('Esta resposta usa ' + marker + ' como exemplo.'), true,
      'encoded output blocked');
    assert.equal(readPrivateSyntheticQuestion({
      scope: 'local_operator_lab', attestedSynthetic: true, question
    }), null, 'attestation never overrides encoded-identifier denial');
  }
  for (const safe of [benignQuestion, benignReply, 'Taxa hipotética de 20% em uma página fictícia.']) {
    assert.equal(hasPrivateIdentifierRisk(safe), false, 'plain percent signs remain valid');
  }
  assert.equal(readPrivateSyntheticQuestion({
    scope: 'local_operator_lab', attestedSynthetic: true, question: benignQuestion
  }), benignQuestion);
});

test('R152 authenticated HTTP refuses encoded questions before any provider dispatch', async t => {
  const bearer = 'R152_FAKE_REVIEW_TOKEN_1234567890123456';
  let calls = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    reviewToken: bearer, enablePrivateConversation: true,
    lab: {
      answer: async () => { calls++; throw Error('no fixed dispatch expected'); },
      answerPrivateConversation: async () => { calls++; throw Error('no free dispatch expected'); },
      inspect: () => ({ syntheticOnly: true })
    }
  });
  t.after(() => server.close());
  for (const marker of encoded) {
    const response = await fetch(server.address + '/__faisca_openai_private/converse', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
      body: JSON.stringify([true, wrap(marker)])
    });
    assert.equal(response.status, 400);
    assert.equal((await response.text()).includes(marker), false);
  }
  assert.equal(calls, 0);
});

test('R152 direct Luna/Terra adapter rejects a forged encoded response with no retry', async () => {
  const answerId = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES.compare)[0];
  let calls = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'R152_FAKE_NOT_ISSUED_PROVIDER_TOKEN_123456',
    extendedPrivateSession: true, maxRequests: 2, maxBudgetUsd: 1,
    fetchImpl: async (_url, request) => {
      calls++;
      const model = calls === 1 ? FAISCA_OPENAI_MODELS.classification : FAISCA_OPENAI_MODELS.answer;
      const body = JSON.parse(request.body);
      assert.equal(body.model, model);
      assert.equal(body.store, false);
      assert.deepEqual(body.tools, []);
      return new Response(JSON.stringify({
        model, status: 'completed',
        output: [{
          type: 'message', role: 'assistant', content: [{
            type: 'output_text',
            text: JSON.stringify(calls === 1 ? { answerId } :
              { reply: 'Esta resposta fictícia usa ' + encoded[0] + ' como exemplo.' })
          }]
        }],
        usage: { input_tokens: 10, output_tokens: 12 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });
  await assert.rejects(lab.answer('compare'), /editorial safety checks/);
  assert.equal(calls, 2);
  await assert.rejects(lab.answer('compare'), /request limit reached/);
  assert.equal(calls, 2, 'no hidden paid retries');
});

async function browser(question, reply) {
  const bearer = 'R152_FAKE_BROWSER_TOKEN_1234567890123456';
  let submit, requests = 0;
  const fields = new Map([
    ['review-token', { value: bearer }],
    ['review-case', { value: 'compare' }],
    ['review-conversation', {}],
    ['review-question', { value: question }],
    ['review-attestation', { checked: true }],
    ['review-send', { disabled: false }],
    ['review-status', { textContent: '' }],
    ['review-answer', { textContent: '' }],
    ['review-sources', { textContent: '' }]
  ]);
  runInNewContext(PRIVATE_REVIEW_JS, {
    document: { getElementById(id) {
      if (id === 'faisca-review-form') return {
        addEventListener(name, fn) { if (name === 'submit') submit = fn; }
      };
      return fields.get(id);
    } },
    window: { addEventListener() {} },
    AbortController, TextDecoder, Uint8Array, Set, JSON, setTimeout, clearTimeout,
    fetch(path, options) {
      requests++;
      assert.equal(path, '/__faisca_openai_private/converse');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.cache, 'no-store');
      return Promise.resolve(new Response(JSON.stringify({
        schema: 'faisca.openai-private-conversation-response.v1',
        status: 'general_answer', answer: reply, sources: [],
        models: ['gpt-6-luna', 'gpt-6.1-terra'], sourceRecipeBound: false,
        requiresEditorialReview: true, publicReady: false, operationalEffects: false
      }), { status: 200 }));
    }
  }, { filename: 'faisca-r152-private-browser.js', timeout: 1000 });
  await submit({ preventDefault() {} });
  return { requests, fields };
}

test('R152 browser denies encoded input before POST and forged HTTP 200 output', async () => {
  for (const marker of encoded) {
    const denied = await browser(wrap(marker), benignReply);
    assert.equal(denied.requests, 0, 'preflight rejected');
    assert.equal(denied.fields.get('review-token').value, '');
    assert.equal(denied.fields.get('review-question').value, '');
    assert.equal(denied.fields.get('review-attestation').checked, false);
  }
  for (const marker of encoded) {
    const denied = await browser(benignQuestion, 'Uma resposta fictícia apresenta ' + marker + ' neste exemplo.');
    assert.equal(denied.requests, 1);
    assert.equal(denied.fields.get('review-answer').textContent, 'Resposta indisponível neste teste.');
    assert.equal(denied.fields.get('review-sources').textContent, '');
    assert.equal(denied.fields.get('review-token').value, '');
    assert.equal(denied.fields.get('review-question').value, '');
  }
  const allowed = await browser(benignQuestion, benignReply);
  assert.equal(allowed.requests, 1);
  assert.equal(allowed.fields.get('review-answer').textContent, benignReply);
});

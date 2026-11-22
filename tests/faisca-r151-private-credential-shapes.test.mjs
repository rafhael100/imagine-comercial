import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { hasPrivateIdentifierRisk } from '../ops/faisca/openai/private-identifier-risk.mjs';
import { readPrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import {
  createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS, FAISCA_OPENAI_TEST_CASES
} from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';

// Synthetic, constructed in memory: these are not issued credentials.
// No test reads environment secrets, uploads tokens or contacts a real service.
const markers = [
  'sk-' + 'R'.repeat(30),
  'sk-proj-' + 'F'.repeat(30),
  'ghp_' + 'Z'.repeat(36),
  'github_pat_' + 'X'.repeat(26),
  'xoxb-' + 'T'.repeat(28),
  'AKIA' + 'A'.repeat(16),
  'Bearer ' + 'Z'.repeat(28),
  '-----BEGIN OPENSSH PRIVATE KEY-----'
];
const benignQuestion = 'Como estruturar uma landing page para um evento fictício?';
const benignReply = 'Uma landing page pode organizar informações gerais de um evento fictício.';

test('R151 secret-shaped strings fail closed before the paid synthetic question gate', () => {
  for (const marker of markers) {
    const question = 'Um site fictício pode utilizar ' + marker + ' neste exemplo?';
    const reply = 'A resposta fictícia inclui o valor ' + marker + ' nesta explicação.';
    assert.equal(hasPrivateIdentifierRisk(question), true, 'private input denied');
    assert.equal(hasPrivateIdentifierRisk(reply), true, 'model output denied');
    assert.equal(readPrivateSyntheticQuestion({
      scope: 'local_operator_lab', attestedSynthetic: true, question
    }), null, 'operator attestation must not override secret detection');
  }
  assert.equal(hasPrivateIdentifierRisk(benignQuestion), false);
  assert.equal(hasPrivateIdentifierRisk(benignReply), false);
  assert.equal(readPrivateSyntheticQuestion({
    scope: 'local_operator_lab', attestedSynthetic: true, question: benignQuestion
  }), benignQuestion);
});

test('R151 direct Luna/Terra adapter rejects a forged secret-bearing API answer with no retries', async () => {
  const answerId = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES.compare)[0];
  let calls = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-' + 'R151_FAKE_NOT_ISSUED_123456789',
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
        output: [{ type: 'message', role: 'assistant',
          content: [{ type: 'output_text', text: JSON.stringify(
            calls === 1 ? { answerId } :
              { reply: 'Uma explicação fictícia inclui ' + markers[0] + ' como exemplo.' }
          ) }] }],
        usage: { input_tokens: 10, output_tokens: 12 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });
  await assert.rejects(lab.answer('compare'), /editorial safety checks/);
  assert.equal(calls, 2);
  assert.equal(lab.inspect().calls, 2);
  await assert.rejects(lab.answer('compare'), /request limit reached/);
  assert.equal(calls, 2, 'no retry, refund or unexpected paid call');
});

test('R151 authenticated private HTTP refuses secret-bearing questions without provider dispatch or echo', async t => {
  const bearer = 'R151_FAKE_REVIEW_TOKEN_1234567890123456';
  let dispatches = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    reviewToken: bearer, enablePrivateConversation: true,
    lab: {
      answer: async () => { dispatches++; throw Error('unexpected fixed dispatch'); },
      answerPrivateConversation: async () => { dispatches++; throw Error('unexpected free dispatch'); },
      inspect: () => ({ syntheticOnly: true })
    }
  });
  t.after(() => server.close());
  for (const marker of markers) {
    const question = 'O site fictício utiliza ' + marker + ' como exemplo técnico?';
    const response = await fetch(server.address + '/__faisca_openai_private/converse', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
      body: JSON.stringify([true, question])
    });
    assert.equal(response.status, 400);
    const text = await response.text();
    assert.equal(text.includes(marker), false, 'never echo a refused identifier');
  }
  assert.equal(dispatches, 0);
});

async function runBrowser(question, reply) {
  const bearer = 'R151_FAKE_BROWSER_TOKEN_1234567890123456';
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
  const response = {
    schema: 'faisca.openai-private-conversation-response.v1',
    status: 'general_answer', answer: reply, sources: [],
    models: ['gpt-6-luna', 'gpt-6.1-terra'],
    sourceRecipeBound: false, requiresEditorialReview: true,
    publicReady: false, operationalEffects: false
  };
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
      return Promise.resolve(new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }));
    }
  }, { filename: 'faisca-r151-private-browser.js', timeout: 1000 });
  await submit({ preventDefault() {} });
  return { requests, fields };
}

test('R151 browser blocks credential-shaped text before POST and after forged HTTP 200', async () => {
  for (const marker of markers) {
    const denied = await runBrowser('Posso usar ' + marker + ' nesta landing page fictícia?', benignReply);
    assert.equal(denied.requests, 0, 'no provider call through browser preflight');
    assert.equal(denied.fields.get('review-token').value, '');
    assert.equal(denied.fields.get('review-question').value, '');
    assert.equal(denied.fields.get('review-attestation').checked, false);
  }
  for (const marker of markers) {
    const denied = await runBrowser(benignQuestion, 'O texto fictício apresenta ' + marker + ' como resposta.');
    assert.equal(denied.requests, 1);
    assert.equal(denied.fields.get('review-answer').textContent, 'Resposta indisponível neste teste.');
    assert.equal(denied.fields.get('review-sources').textContent, '');
    assert.equal(denied.fields.get('review-token').value, '');
    assert.equal(denied.fields.get('review-question').value, '');
  }
  const allowed = await runBrowser(benignQuestion, benignReply);
  assert.equal(allowed.requests, 1);
  assert.equal(allowed.fields.get('review-answer').textContent, benignReply);
});

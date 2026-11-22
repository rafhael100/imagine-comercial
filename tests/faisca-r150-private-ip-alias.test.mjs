import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { hasPrivateIdentifierRisk } from '../ops/faisca/openai/private-identifier-risk.mjs';
import { readPrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS, FAISCA_OPENAI_TEST_CASES } from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';

// All identifiers are reserved, fictional or deliberately confusable Unicode.
// They must never be replaced by client or operator records.
// The WHATWG URL parser maps these aliases to real IP hosts without a DNS lookup.
// All examples are fabricated and must remain within the private test fixture.
const risky = [
  'O servidor fictício utiliza 127.1 para testes internos?',
  'O servidor fictício utiliza 127.0.1 nesta simulação?',
  'O site fictício usa 0x7f000001 como endereço de testes?',
  'A página fictícia usa 0x7f.1 como endereço de testes?',
  'A página fictícia aponta 0177.0.0.1 como endereço interno?',
  'O servidor fictício usa 10.1 como alias de laboratório?'
];
const unsafeReplies = [
  'O servidor fictício responde no alias 127.1.',
  'O endereço fictício de testes é 0x7f000001.',
  'O endereço local pode ser escrito como 0x7f.1.',
  'O endereço fictício usa 0177.0.0.1.'
];
const safeQuestion = 'Como estruturar uma landing page para um evento fictício?';
const safeReply = 'Uma landing page pode organizar informações gerais de um evento fictício.';

test('R150 shortened, octal and hexadecimal IP aliases are rejected without blocking benign guidance', () => {
  for (const alias of ['127.1', '127.0.1', '0x7f000001', '0x7f.1', '0177.0.0.1']) {
    assert.equal(new URL('http://' + alias).hostname, '127.0.0.1', alias);
  }
  for (const input of risky) {
    assert.equal(hasPrivateIdentifierRisk(input), true, input);
    assert.equal(readPrivateSyntheticQuestion({
      scope: 'local_operator_lab', attestedSynthetic: true, question: input
    }), null, 'Nothing containing a host may leave the private question gate');
  }
  for (const reply of unsafeReplies) assert.equal(hasPrivateIdentifierRisk(reply), true, reply);
  assert.equal(hasPrivateIdentifierRisk(safeQuestion), false);
  assert.equal(hasPrivateIdentifierRisk(safeReply), false);
  assert.equal(readPrivateSyntheticQuestion({
    scope: 'local_operator_lab', attestedSynthetic: true, question: safeQuestion
  }), safeQuestion);
});

test('R150 private API mock rejects numeric IP aliases without retries or refunds', async () => {
  const answerId = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES.compare)[0];
  for (const reply of unsafeReplies.slice(0, 2)) {
    let calls = 0;
    const lab = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: 'sk-R150_SYNTHETIC_NOT_REAL_1234567890',
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
            content: [{ type: 'output_text', text: JSON.stringify(calls === 1 ? { answerId } : { reply }) }] }],
          usage: { input_tokens: 10, output_tokens: 12 }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    });
    await assert.rejects(lab.answer('compare'), /editorial safety checks/);
    assert.equal(calls, 2);
    assert.equal(lab.inspect().calls, 2);
    await assert.rejects(lab.answer('compare'), /request limit reached/);
    assert.equal(calls, 2, 'No retry or quota refund after a blocked response');
  }
});

test('R150 authenticated loopback rejects IPv4 aliases without any provider dispatch or echo', async t => {
  const bearer = 'R150_SYNTHETIC_HTTP_BEARER_1234567890123';
  let calls = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    reviewToken: bearer, enablePrivateConversation: true,
    lab: {
      answer: async () => { calls++; throw Error('Unexpected fixed request'); },
      answerPrivateConversation: async () => { calls++; throw Error('Unexpected free request'); },
      inspect: () => ({ syntheticOnly: true })
    }
  });
  t.after(() => server.close());
  for (const question of risky) {
    const response = await fetch(server.address + '/__faisca_openai_private/converse', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
      body: JSON.stringify([true, question])
    });
    assert.equal(response.status, 400, question);
    const body = await response.text();
    assert.equal(body.includes(question), false);
    assert.equal(body.includes('0x7f000001'), false);
  }
  assert.equal(calls, 0);
});

async function browserRun(question, reply) {
  const bearer = 'R150_SYNTHETIC_BROWSER_BEARER_1234567890123';
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
  }, { filename: 'faisca-r150-private-browser.js', timeout: 1000 });
  await submit({ preventDefault() {} });
  return { requests, fields };
}

test('R150 actual private browser JavaScript fails closed before POST and against forged HTTP 200', async () => {
  for (const question of risky) {
    const { requests, fields } = await browserRun(question, safeReply);
    assert.equal(requests, 0, question);
    assert.equal(fields.get('review-token').value, '');
    assert.equal(fields.get('review-question').value, '');
    assert.equal(fields.get('review-attestation').checked, false);
  }
  for (const reply of unsafeReplies) {
    const { requests, fields } = await browserRun(safeQuestion, reply);
    assert.equal(requests, 1, reply);
    assert.equal(fields.get('review-answer').textContent, 'Resposta indisponível neste teste.');
    assert.equal(fields.get('review-sources').textContent, '');
    assert.equal(fields.get('review-token').value, '');
    assert.equal(fields.get('review-question').value, '');
  }
  const { requests, fields } = await browserRun(safeQuestion, safeReply);
  assert.equal(requests, 1);
  assert.equal(fields.get('review-answer').textContent, safeReply);
});

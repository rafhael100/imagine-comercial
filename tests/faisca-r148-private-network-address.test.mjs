import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { hasPrivateIdentifierRisk } from '../ops/faisca/openai/private-identifier-risk.mjs';
import { readPrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS, FAISCA_OPENAI_TEST_CASES } from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { PRIVATE_REVIEW_JS } from '../ops/faisca/openai/private-review-page.mjs';

const unsafeQuestions = [
  'Uma landing page usa o domínio loja-ficticia.example neste teste?',
  'O conteúdo de teste aponta para 10.0.0.1 sem autenticação?',
  'O servidor fictício responde no endereço 2001:db8::1 para testes?',
  'Uma landing page local usa localhost durante o desenvolvimento?',
  'Uma campanha usa o domínio ＬＯＪＡ．ＥＸＡＭＰＬＥ na simulação?'
];
const safeQuestion = 'Como organizar os textos de uma landing page para evento fictício?';
const unsafeAnswers = [
  'A estrutura pode incluir o domínio loja-ficticia.example no rodapé.',
  'O servidor do site fictício responde no endereço 10.0.0.1.',
  'O endereço da infraestrutura de teste é 2001:db8::1.',
  'A página do exemplo deve utilizar localhost para acesso.'
];
const neutral = 'Uma landing page pode organizar informações gerais de um evento fictício.';

test('R148 rejects bare hostnames and network literals without losing benign questions', () => {
  for (const question of unsafeQuestions) {
    assert.equal(hasPrivateIdentifierRisk(question), true, question);
    assert.equal(readPrivateSyntheticQuestion({
      scope: 'local_operator_lab', attestedSynthetic: true, question
    }), null, 'Preflight must reject without keeping or returning operator text');
  }
  for (const answer of unsafeAnswers) assert.equal(hasPrivateIdentifierRisk(answer), true, answer);
  assert.equal(hasPrivateIdentifierRisk(safeQuestion), false);
  assert.equal(hasPrivateIdentifierRisk(neutral), false);
  assert.equal(readPrivateSyntheticQuestion({
    scope: 'local_operator_lab', attestedSynthetic: true, question: safeQuestion
  }), safeQuestion);
});

function fakePaidLab(answer) {
  let calls = 0;
  const answerId = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES.compare)[0];
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-R148_SYNTHETIC_NOT_REAL_123456789',
    extendedPrivateSession: true, maxRequests: 2, maxBudgetUsd: 1,
    fetchImpl: async (_url, req) => {
      calls++;
      const model = calls === 1 ? FAISCA_OPENAI_MODELS.classification : FAISCA_OPENAI_MODELS.answer;
      const payload = JSON.parse(req.body);
      assert.equal(payload.model, model);
      assert.equal(payload.store, false);
      assert.deepEqual(payload.tools, []);
      return new Response(JSON.stringify({
        model, status: 'completed',
        output: [{ type: 'message', role: 'assistant',
          content: [{ type: 'output_text', text: JSON.stringify(calls === 1 ? { answerId } : { reply: answer }) }] }],
        usage: { input_tokens: 10, output_tokens: 12 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });
  return { lab, calls: () => calls };
}

test('R148 direct private Luna/Terra adapter refuses hostnames on egress without retry or reserve refund', async () => {
  for (const answer of unsafeAnswers.slice(0, 3)) {
    const model = fakePaidLab(answer);
    await assert.rejects(model.lab.answer('compare'), /editorial safety checks/);
    assert.equal(model.calls(), 2);
    assert.equal(model.lab.inspect().calls, 2);
    await assert.rejects(model.lab.answer('compare'), /request limit reached/);
    assert.equal(model.calls(), 2);
  }
});

test('R148 authenticated loopback HTTP preflight never dispatches fictional-looking hostnames or IPs', async t => {
  const bearer = 'R148_SYNTHETIC_REVIEW_ONLY_1234567890';
  let calls = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    reviewToken: bearer, enablePrivateConversation: true,
    lab: {
      answer: async () => { calls++; throw new Error('Unexpected paid fixed call'); },
      answerPrivateConversation: async () => { calls++; throw new Error('Unexpected paid free call'); },
      inspect: () => ({ syntheticOnly: true })
    }
  });
  t.after(() => server.close());
  for (const question of unsafeQuestions) {
    const response = await fetch(server.address + '/__faisca_openai_private/converse', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
      body: JSON.stringify([true, question])
    });
    assert.equal(response.status, 400, question);
    const body = await response.text();
    assert.equal(body.includes(question), false);
    assert.equal(body.includes('loja-ficticia.example'), false);
  }
  assert.equal(calls, 0, 'Rejected content never leaves the private HTTP boundary');
});

async function browserReply({ question = safeQuestion, reply = neutral }) {
  const bearer = 'R148_SYNTHETIC_BROWSER_1234567890';
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
  const body = {
    schema: 'faisca.openai-private-conversation-response.v1',
    status: 'general_answer', answer: reply, sources: [],
    models: ['gpt-6-luna', 'gpt-6.1-terra'],
    sourceRecipeBound: false, requiresEditorialReview: true,
    publicReady: false, operationalEffects: false
  };
  runInNewContext(PRIVATE_REVIEW_JS, {
    document: { getElementById(id) {
      if (id === 'faisca-review-form') return {
        addEventListener(name, callback) { if (name === 'submit') submit = callback; }
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
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }
  }, { filename: 'faisca-r148-browser.js', timeout: 1000 });
  await submit({ preventDefault() {} });
  return { requests, fields };
}

test('R148 actual private browser script rejects network identifiers before POST and forged HTTP 200 on egress', async () => {
  for (const question of unsafeQuestions) {
    const { requests, fields } = await browserReply({ question });
    assert.equal(requests, 0, question);
    assert.equal(fields.get('review-token').value, '');
    assert.equal(fields.get('review-question').value, '');
    assert.equal(fields.get('review-attestation').checked, false);
  }
  for (const reply of unsafeAnswers) {
    const { requests, fields } = await browserReply({ reply });
    assert.equal(requests, 1, reply);
    assert.equal(fields.get('review-answer').textContent, 'Resposta indisponível neste teste.');
    assert.equal(fields.get('review-sources').textContent, '');
    assert.equal(fields.get('review-token').value, '');
    assert.equal(fields.get('review-question').value, '');
  }
  const { requests, fields } = await browserReply({});
  assert.equal(requests, 1);
  assert.equal(fields.get('review-answer').textContent, neutral);
});

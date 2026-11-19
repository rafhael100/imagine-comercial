import test from 'node:test';
import assert from 'node:assert/strict';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { preparePrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';

const key = 'sk-r81-synthetic-fixture-key-123456';
const question = 'Qual a diferença entre um site Onepage e uma Landing Page?';
function prepared() {
  return preparePrivateSyntheticQuestion({
    scope: 'local_operator_lab', attestedSynthetic: true, question
  });
}
function response(output) {
  return new Response(JSON.stringify({
    model: Object.hasOwn(output, 'reply') ? FAISCA_OPENAI_MODELS.answer : FAISCA_OPENAI_MODELS.classification,
    status: 'completed',
    output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(output) }] }],
    usage: { input_tokens: 200, output_tokens: 35 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
function mock() {
  const requests = [];
  return { requests, async fetchImpl(url, init) {
    const body = JSON.parse(init.body);
    requests.push({ url, body });
    if (body.model === FAISCA_OPENAI_MODELS.classification) {
      return response({ answerId: JSON.parse(body.input).approvedCandidates[0].id });
    }
    return response({ reply: 'O Site Onepage apresenta a empresa em uma página, enquanto a Landing Page é dedicada a uma oferta ou campanha específica.' });
  } };
}

test('R81 expanded spending and throughput require explicit private operator configuration', () => {
  for (const values of [
    { maxRequests: 3 },
    { maxBudgetUsd: 1 },
    { extendedPrivateSession: 'true', maxRequests: 50 },
    { extendedPrivateSession: true, maxRequests: 101, maxBudgetUsd: 5 },
    { extendedPrivateSession: true, maxRequests: 0, maxBudgetUsd: 5 },
    { extendedPrivateSession: true, maxRequests: 6, maxBudgetUsd: 11 },
    { extendedPrivateSession: true, maxRequests: Infinity, maxBudgetUsd: 2 },
    { extendedPrivateSession: true, maxRequests: 20, maxBudgetUsd: Infinity }
  ]) {
    assert.throws(() => createFaiscaOpenAILiveLab({
      enabled: true, apiKey: key, ...values
    }), TypeError, JSON.stringify(values));
  }
  const old = createFaiscaOpenAILiveLab({ enabled: true, apiKey: key });
  assert.equal(old.inspect().maxRequests, 2);
  assert.equal(old.inspect().extendedPrivateSession, false);
  assert.equal(old.inspect().maxBudgetUsd, 0.01);
});

test('R81 operator runs several grounded synthetic OpenAI conversations in one private session', async () => {
  const provider = mock();
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, fetchImpl: provider.fetchImpl,
    enableOperatorSyntheticQuestion: true,
    extendedPrivateSession: true,
    maxRequests: 8, maxBudgetUsd: 5
  });
  for (let i = 0; i < 4; i++) {
    const result = await lab.answerPreparedSyntheticQuestion(prepared());
    assert.equal(result.status, 'draft_answer');
    assert.equal(result.publicReady, false);
    assert.equal(result.operationalEffects, false);
    assert.deepEqual(result.modelIds, ['gpt-6-luna','gpt-6.1-terra']);
    assert.ok(result.sourceIds.length > 0);
  }
  assert.equal(provider.requests.length, 8);
  assert.deepEqual(provider.requests.map(item => item.body.model), [
    'gpt-6-luna', 'gpt-6.1-terra', 'gpt-6-luna', 'gpt-6.1-terra',
    'gpt-6-luna', 'gpt-6.1-terra', 'gpt-6-luna', 'gpt-6.1-terra'
  ]);
  for (const {body,url} of provider.requests) {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(body.store, false);
    assert.deepEqual(body.tools, []);
    assert.equal(body.tool_choice, 'none');
    assert.equal('previous_response_id' in body, false);
  }
  const state = lab.inspect();
  assert.equal(state.calls, 8);
  assert.equal(state.maxRequests, 8);
  assert.equal(state.extendedPrivateSession, true);
  assert.ok(state.reservedUsd > 0 && state.reservedUsd < 5);
  assert.equal(state.durableBillingLimit, false);
  await assert.rejects(lab.answerPreparedSyntheticQuestion(prepared()), /request limit reached/);
  assert.equal(provider.requests.length, 8, 'No paid call after session limit.');
});

test('R81 extended session refuses insufficient reserved budget BEFORE any provider request', async () => {
  let dispatched = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key,
    enableOperatorSyntheticQuestion: true,
    extendedPrivateSession: true,
    maxRequests: 50, maxBudgetUsd: 0.000001,
    fetchImpl: async () => {
      dispatched++;
      return response({ answerId: 'none' });
    }
  });
  await assert.rejects(lab.answerPreparedSyntheticQuestion(prepared()), /budget reservation refused/);
  assert.equal(dispatched, 0);
  assert.equal(lab.inspect().calls, 0);
});

test('R81 extended mode never turns the original public or browser input into a live AI request', async () => {
  const provider = mock();
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, fetchImpl: provider.fetchImpl,
    extendedPrivateSession: true, maxRequests: 50, maxBudgetUsd: 10
  });
  for (const value of [
    { question }, 'Quero pagar minha fatura',
    'Minha senha é desconhecida', { text: question }
  ]) {
    await assert.rejects(lab.answerPreparedSyntheticQuestion(value), TypeError);
  }
  assert.equal(provider.requests.length, 0);
  assert.equal(lab.inspect().liveEnabledForPublic, false);
});

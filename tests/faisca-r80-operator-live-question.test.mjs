import test from 'node:test';
import assert from 'node:assert/strict';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { preparePrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';

const key = 'sk-r80-private-laboratory-123456789';
const question = 'Qual a diferença entre um site Onepage e uma Landing Page?';
const approved = () => preparePrivateSyntheticQuestion({
  scope: 'local_operator_lab', attestedSynthetic: true, question
});
function output(value) {
  return new Response(JSON.stringify({
    status: 'completed',
    output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
    usage: { input_tokens: 400, output_tokens: 42 }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}
function fixture() {
  const calls = [];
  return {
    calls,
    async fetchImpl(url, init) {
      const body = JSON.parse(init.body);
      calls.push({ url, body, init });
      if(body.model === FAISCA_OPENAI_MODELS.classification) {
        const candidates = JSON.parse(body.input).approvedCandidates;
        return output({ answerId: candidates[0].id });
      }
      return output({ reply: 'O Site Onepage apresenta a empresa em uma página e a Landing Page foca uma campanha ou oferta específica. As condições finais são confirmadas pela Imagine.' });
    }
  };
}

test('R80 opt-in must be explicit; canned scenarios remain available with the default policy', async () => {
  const mock = fixture();
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, fetchImpl: mock.fetchImpl
  });
  assert.equal(lab.inspect().operatorSyntheticTextEnabled, false);
  await assert.rejects(lab.answerPreparedSyntheticQuestion(approved()), TypeError);
  assert.equal(mock.calls.length, 0);
  const result = await lab.answer('compare');
  assert.equal(result.status, 'draft_answer');
  assert.equal(mock.calls.length, 2);
  assert.equal(lab.inspect().calls, 2);
});

test('R80 approved fictional question invokes Luna and Terra, but no customer or operational data leaves', async () => {
  const mock = fixture();
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, fetchImpl: mock.fetchImpl,
    enableOperatorSyntheticQuestion: true
  });
  const result = await lab.answerPreparedSyntheticQuestion(approved());
  assert.equal(result.status, 'draft_answer');
  assert.equal(result.publicReady, false);
  assert.equal(result.operationalEffects, false);
  assert.equal(result.requiresEditorialReview, true);
  assert.equal(result.modelCalls, 2);
  assert.deepEqual(result.modelIds, ['gpt-6-luna', 'gpt-6.1-terra']);
  assert.ok(result.sourceIds.length > 0);
  assert.equal(mock.calls.length, 2);
  assert.deepEqual(mock.calls.map(call => call.body.model), ['gpt-6-luna','gpt-6.1-terra']);
  for (const call of mock.calls) {
    assert.equal(call.url, 'https://api.openai.com/v1/responses');
    assert.equal(call.body.store, false);
    assert.deepEqual(call.body.tools, []);
    assert.equal(call.body.tool_choice, 'none');
    assert.equal(call.body.text.format.strict, true);
    assert.equal(call.init.headers.Authorization, 'Bearer ' + key);
    assert.equal(call.init.redirect, 'error');
    assert.equal('previous_response_id' in call.body, false);
    assert.equal(call.init.body.includes(key), false);
    for (const field of ['buyerId', 'tenantId', 'customerEmail', 'phone', 'CPF', 'password']) {
      assert.equal(call.init.body.includes(field), false, field);
    }
  }
  assert.equal(JSON.parse(mock.calls[0].body.input).syntheticQuestion, question);
  assert.equal(JSON.parse(mock.calls[1].body.input).syntheticQuestion, question);
  assert.equal(lab.inspect().operatorSyntheticTextEnabled, true);
  assert.equal(lab.inspect().durableBillingLimit, false);
});

test('R80 forged or modified input cannot trigger any paid request', async () => {
  const mock = fixture();
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, fetchImpl: mock.fetchImpl,
    enableOperatorSyntheticQuestion: true
  });
  const good = approved();
  for (const candidate of [
    null, { ...good }, { question }, {
      ...good, question: 'Meu pedido de pagamento foi aprovado?'
    }, 'Qual o valor de um Onepage?'
  ]) await assert.rejects(lab.answerPreparedSyntheticQuestion(candidate), TypeError);
  assert.equal(mock.calls.length, 0);
});

test('R80 unsupported model output never creates an approved marketing claim', async () => {
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, enableOperatorSyntheticQuestion: true,
    fetchImpl: async () => output({ answerId: 'crm.write' })
  });
  const result = await lab.answerPreparedSyntheticQuestion(approved());
  assert.equal(result.status, 'unsupported');
  assert.equal(result.publicReady, false);
  assert.equal(result.operationalEffects, false);
  assert.equal(result.modelCalls, 1);
});

test('R80 duplicated concurrent fictional requests cannot send parallel API calls', async () => {
  let release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const first = new Promise(resolve => { started = resolve; });
  let dispatched = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, enableOperatorSyntheticQuestion: true,
    fetchImpl: async (url, init) => {
      dispatched++;
      if (dispatched === 1) { started(); await gate; }
      const body = JSON.parse(init.body);
      return body.model === FAISCA_OPENAI_MODELS.classification
        ? output({ answerId: JSON.parse(body.input).approvedCandidates[0].id })
        : output({ reply: 'A solução Onepage é destinada a apresentar uma empresa. Uma Landing Page apoia uma campanha específica de divulgação.' });
    }
  });
  const work = lab.answerPreparedSyntheticQuestion(approved());
  await first;
  await assert.rejects(lab.answerPreparedSyntheticQuestion(approved()), /Only one private OpenAI trial/);
  release();
  const result = await work;
  assert.equal(result.status, 'draft_answer');
  assert.equal(dispatched, 2);
  await assert.rejects(lab.answerPreparedSyntheticQuestion(approved()), /request limit reached/);
});

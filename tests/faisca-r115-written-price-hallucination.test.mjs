import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPrivateUnreviewedPriceClaim } from '../ops/faisca/openai/private-price-claim-risk.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import {
  createFaiscaOpenAILiveLab, FAISCA_OPENAI_LIVE_LAB_SCHEMA,
  FAISCA_OPENAI_MODELS, FAISCA_OPENAI_TEST_CASES
} from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const token = 'R115_PRIVATE_WRITTEN_AMOUNT_SYNTHETIC_TOKEN_12345';
const caseId = 'compare';
const selected = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES[caseId])
  .find(id => Boolean(getGroundedAnswer(id)));
assert.ok(selected);
const sourceIds = getGroundedAnswer(selected).sources.map(source => source.id);
const valid = 'Onepage apresenta a empresa numa pagina organizada, enquanto Landing Page destaca uma oferta.';
const dangerous = [
  'O site Onepage custa cento e vinte reais por mes, sem nenhuma consulta adicional.',
  'A mensalidade do seu plano sera de trinta e cinco reais por mes.',
  'Nossa Landing Page é grátis e inclui hospedagem para todos.',
  'O plano Onepage fica sem mensalidade e pode ser usado livremente.',
  'O servico foi aprovado por ＶＩＮＴＥ e cinco REAIS mensais.'
];

test('R115 typed guard identifies written monetary commitments, without blocking normal service guidance', () => {
  assert.equal(hasPrivateUnreviewedPriceClaim(valid), false);
  assert.equal(hasPrivateUnreviewedPriceClaim('Os valores oficiais precisam de confirmacao.'), false);
  assert.equal(hasPrivateUnreviewedPriceClaim('Resultados reais variam conforme contexto.'), false);
  for (const text of dangerous) {
    assert.equal(hasPrivateUnreviewedPriceClaim(text), true, text);
  }
  assert.equal(hasPrivateUnreviewedPriceClaim({}), true);
});

test('R115 HTTP fixed case rejects model/injected response with written fee despite exact source IDs', async t => {
  let reply = valid, calls = 0;
  const lab = {
    answer: async () => {
      calls++;
      return {
        schema: FAISCA_OPENAI_LIVE_LAB_SCHEMA, status: 'draft_answer',
        answerId: selected, text: reply, sourceIds,
        modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
        publicReady: false, operationalEffects: false
      };
    },
    inspect: () => ({ syntheticOnly: true, externalCalls: 0 })
  };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const send = () => fetch(server.address + server.path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId })
  });

  assert.equal((await send()).status, 200);
  for (const text of dangerous) {
    reply = text;
    const response = await send();
    assert.equal(response.status, 503, text);
    const payload = await response.text();
    assert.ok(!payload.includes(text), 'Never echo an invented price to the operator');
    assert.equal(server.inspect().providerUnavailable, false, 'Do not claim an uncertain charge on editorial refusal');
  }
  assert.equal(calls, 1 + dangerous.length);
});

test('R115 API Luna/Terra adapter rejects a written price before returning an HTTP draft', async () => {
  const models = [];
  const apiResponse = (model, value) => new Response(JSON.stringify({
    model, status: 'completed',
    output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
    usage: { input_tokens: 100, output_tokens: 50 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-r115-synthetic-only-1234567890123456',
    extendedPrivateSession: true, maxBudgetUsd: 1, maxRequests: 2,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.method, 'POST');
      assert.equal(JSON.parse(init.body).store, false);
      models.push(JSON.parse(init.body).model);
      return apiResponse(models.at(-1), models.length === 1
        ? { answerId: selected } : { reply: dangerous[0] });
    }
  });
  await assert.rejects(lab.answer(caseId), /editorial safety checks/);
  assert.deepEqual(models, [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer]);
  assert.equal(lab.inspect().calls, 2);
  assert.equal(lab.inspect().liveEnabledForPublic, false);
});

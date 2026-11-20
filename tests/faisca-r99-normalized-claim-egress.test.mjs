import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import {
  FAISCA_OPENAI_LIVE_LAB_SCHEMA, FAISCA_OPENAI_MODELS,
  FAISCA_OPENAI_TEST_CASES, createFaiscaOpenAILiveLab
} from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

const token = 'R99_NORMALIZED_CLAIMS_PRIVATE_TOKEN_123456789';
const cleanQuestion = 'Vale a pena usar uma landing page para divulgar um evento?';
const cleanGeneral = 'Uma landing page reúne as informações do evento em uma página dedicada.';
const cleanFixed = 'O site Onepage apresenta o negócio em uma página, enquanto uma Landing Page destaca uma oferta.';
const inventedClaims = [
  'O valor desta Landing Page é Ｒ＄　５００ e já pode ser contratado.',
  'O ｐａｇａｍｅｎｔｏ ｆｏｉ ａｐｒｏｖａｄｏ para a sua página.',
  'O ｃｏｎｔｒａｔｏ ｆｏｉ ａｓｓｉｎａｄｏ com a Imagine hoje.'
];
const auth = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
const selected = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES.compare)
  .find(id => Boolean(getGroundedAnswer(id)));

test('R99 independent HTTP gate blocks Unicode-compatible fabricated claims in a grounded fixed case', async t => {
  assert.ok(selected);
  const sources = getGroundedAnswer(selected).sources.map(source => source.id);
  let text = cleanFixed, count = 0;
  const lab = {
    answer: async () => {
      count++;
      return {
        schema: FAISCA_OPENAI_LIVE_LAB_SCHEMA,
        status: 'draft_answer', text, answerId: selected,
        sourceIds: sources,
        modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
        publicReady: false, operationalEffects: false
      };
    },
    inspect: () => ({ fixtureOnly: true, count })
  };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  const send = () => fetch(server.address + '/__faisca_openai_private/respond', {
    method: 'POST', headers: auth, body: JSON.stringify({ caseId: 'compare' })
  });
  assert.equal((await send()).status, 200, 'Safe reviewed fixture must remain available');
  for (const dangerous of inventedClaims) {
    text = dangerous;
    const response = await send();
    assert.equal(response.status, 503, JSON.stringify(dangerous));
    const body = await response.text();
    assert.match(body, /"status":"unavailable"/);
    assert.ok(!body.includes(dangerous), 'Never send invented financial/operational claims');
  }
  assert.equal(count, inventedClaims.length + 1);
});

test('R99 private conversation cannot render a normalized Unicode fake payment', async t => {
  let text = cleanGeneral;
  const lab = {
    answer: async () => { throw new Error('Fixed-case not used'); },
    answerPrivateConversation: async () => ({
      status: 'general_answer', text, sourceIds: [],
      modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
      publicReady: false, operationalEffects: false
    }),
    inspect: () => ({ fixtureOnly: true })
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const send = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', headers: auth, body: JSON.stringify([true, cleanQuestion])
  });
  assert.equal((await send()).status, 200);
  for (const dangerous of inventedClaims) {
    text = dangerous;
    const response = await send();
    assert.equal(response.status, 503, JSON.stringify(dangerous));
    assert.ok(!(await response.text()).includes(dangerous));
  }
});

test('R99 Luna/Terra API adapter rejects Unicode-compatible invented price before returning a draft', async () => {
  assert.ok(selected);
  const requestModels = [];
  const response = (model, data) => new Response(JSON.stringify({
    model, status: 'completed',
    output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(data) }] }],
    usage: { input_tokens: 120, output_tokens: 40 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-r99-fixture-only-123456789012345',
    extendedPrivateSession: true, maxBudgetUsd: 1, maxRequests: 2,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const payload = JSON.parse(options.body);
      assert.equal(payload.store, false);
      assert.deepEqual(payload.tools, []);
      requestModels.push(payload.model);
      return payload.model === FAISCA_OPENAI_MODELS.classification
        ? response(payload.model, { answerId: selected })
        : response(payload.model, { reply: inventedClaims[0] });
    }
  });
  await assert.rejects(lab.answer('compare'), /editorial safety checks/);
  assert.deepEqual(requestModels, [
    FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
  ]);
  assert.equal(lab.inspect().calls, 2);
});

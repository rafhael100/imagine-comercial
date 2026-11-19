import test from 'node:test';
import assert from 'node:assert/strict';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const bearer = 'R81_EXTENDED_PRIVATE_REVIEW_TOKEN_123456';
const key = 'sk-r81-synthetic-browser-fixture-key-98765';
function answerResponse(payload) {
  return new Response(JSON.stringify({
    status: 'completed', output: [{
      type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(payload) }]
    }],
    usage: { input_tokens: 150, output_tokens: 25 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
test('R81 private browser HTTP may review several independent Luna/Terra answers in one bounded process', async t => {
  const calls = [];
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, extendedPrivateSession: true,
    maxRequests: 6, maxBudgetUsd: 2,
    fetchImpl: async (url, init) => {
      const payload = JSON.parse(init.body);
      calls.push({ url, payload });
      return payload.model === FAISCA_OPENAI_MODELS.classification
        ? answerResponse({
          answerId: JSON.parse(payload.input).approvedCandidates[0].id
        })
        : answerResponse({
          reply: 'O atendimento comercial da Imagine apresenta soluções de sites e campanhas conforme a necessidade. A proposta oficial determina as condições finais.'
        });
    }
  });
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: bearer, port: 0 });
  t.after(() => server.close());
  const send = caseId => fetch(server.address + server.path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json',
      Origin: server.address
    },
    body: JSON.stringify({ caseId }),
    redirect: 'error', credentials: 'omit'
  });
  for (const caseId of ['compare', 'process', 'pricing']) {
    const result = await send(caseId);
    assert.equal(result.status, 200, caseId);
    const body = await result.json();
    assert.equal(body.status, 'draft_answer');
    assert.equal(body.syntheticCaseId, caseId);
    assert.equal(body.publicReady, false);
    assert.equal(body.operationalEffects, false);
    assert.equal(body.requiresEditorialReview, true);
    assert.deepEqual(body.models, ['gpt-6-luna', 'gpt-6.1-terra']);
    assert.ok(body.sources.length > 0);
    assert.doesNotMatch(JSON.stringify(body), /sk-r81-|Authorization|apiKey/);
  }
  assert.equal(server.inspect().requests, 3);
  assert.equal(lab.inspect().calls, 6);
  assert.equal(calls.length, 6);
  assert.deepEqual(calls.map(c => c.payload.model), [
    'gpt-6-luna','gpt-6.1-terra', 'gpt-6-luna','gpt-6.1-terra',
    'gpt-6-luna','gpt-6.1-terra'
  ]);
  // No hidden API retry or a fourth paid transaction when quota exhausted.
  const overLimit = await send('compare');
  assert.equal(overLimit.status, 503);
  assert.equal((await overLimit.json()).status, 'unavailable');
  assert.equal(calls.length, 6);
  assert.ok(lab.inspect().reservedUsd > 0 && lab.inspect().reservedUsd < 2);
});

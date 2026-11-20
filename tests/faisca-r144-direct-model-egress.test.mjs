import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS,
  FAISCA_OPENAI_TEST_CASES
} from '../ops/faisca/openai/live-lab.mjs';
import { retrieveCandidateAnswerIds } from '../ops/faisca/model-router/contract.mjs';

const approvedAnswerId = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES.compare)[0];
const neutralReply =
  'Uma landing page pode organizar informações gerais de um evento fictício e facilitar a leitura.';
const forbidden = [
  'Já publiquei seu site e configurei seu domínio.',
  'Sua campanha está ativa e pronta para receber contatos.',
  'Uma landing page garante novas vendas para o negócio.',
  'Uma campanha vai gerar 120 leads.'
];

function fixtureLab(terraReply) {
  let dispatches = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-R144_SYNTHETIC_FIXTURE_NOT_A_REAL_KEY_123456',
    extendedPrivateSession: true, maxRequests: 2, maxBudgetUsd: 1,
    fetchImpl: async (_url, init) => {
      dispatches++;
      const req = JSON.parse(init.body);
      assert.equal(req.store, false);
      assert.deepEqual(req.tools, []);
      assert.equal(req.tool_choice, 'none');
      assert.equal(req.model,
        dispatches === 1 ? FAISCA_OPENAI_MODELS.classification : FAISCA_OPENAI_MODELS.answer);
      const payload = dispatches === 1
        ? { answerId: approvedAnswerId } : { reply: terraReply };
      return new Response(JSON.stringify({
        model: req.model, status: 'completed',
        output: [{ type: 'message', role: 'assistant', content: [
          { type: 'output_text', text: JSON.stringify(payload) }
        ] }],
        usage: { input_tokens: 15, output_tokens: 20 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });
  return { lab, count: () => dispatches };
}

for (const reply of forbidden) {
  test('R144 direct fixed-case adapter refuses fabricated execution/results', async () => {
    const { lab, count } = fixtureLab(reply);
    await assert.rejects(lab.answer('compare'), /editorial safety checks/);
    assert.equal(count(), 2, 'No retries, side effects or extra paid dispatch');
    assert.equal(lab.inspect().calls, 2);
    assert.equal(lab.inspect().liveEnabledForPublic, false);
    await assert.rejects(lab.answer('compare'), /request limit reached/);
    assert.equal(count(), 2, 'Rejected reply must not refund reservation');
  });
}

test('R144 neutral fixed-case Luna/Terra draft remains available with pinned provenance', async () => {
  const { lab, count } = fixtureLab(neutralReply);
  const response = await lab.answer('compare');
  assert.equal(response.status, 'draft_answer');
  assert.equal(response.text, neutralReply);
  assert.deepEqual(response.modelIds,
    [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer]);
  assert.equal(response.sourceIds.length > 0, true);
  assert.equal(response.operationalEffects, false);
  assert.equal(response.publicReady, false);
  assert.equal(count(), 2);
});

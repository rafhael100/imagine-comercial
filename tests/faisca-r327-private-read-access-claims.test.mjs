import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPrivateOperationalClaim, safePrivateGeneralReply } from '../ops/faisca/openai/private-conversation-policy.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const claims = [
  'Consultei o painel de métricas e confirmei a situação.',
  'Tenho acesso aos relatórios internos.',
  'Posso consultar o CRM para verificar a situação.',
  'Acessamos seus registros para preparar uma orientação.'
];
const positive = 'Você pode consultar seu painel para acompanhar métricas.';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const token = 'R327_PRIVATE_SYNTHETIC_FIXTURE_ONLY_2026';
const raw = { scope: 'local_operator_lab', attestedSynthetic: true, question };

test('R327 refuses invented private read access without blocking neutral guidance', () => {
  for (const claim of claims) {
    assert.equal(hasPrivateOperationalClaim(claim), true);
    assert.equal(safePrivateGeneralReply(claim), false);
  }
  assert.equal(hasPrivateOperationalClaim(positive), false);
  assert.equal(safePrivateGeneralReply(positive), true);
});

test('R327 direct Luna/Terra fixture falls back to confirmation on invented read access', async () => {
  let calls = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-r327-fixture-only-123456789012345',
    enablePrivateConversation: true, extendedPrivateSession: true,
    maxRequests: 20, maxBudgetUsd: 10,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const body = JSON.parse(init.body);
      assert.equal(body.store, false);
      assert.deepEqual(body.tools, []);
      calls++;
      const data = body.model === FAISCA_OPENAI_MODELS.classification
        ? { topic: 'general' } : { reply: claims[0] };
      return new Response(JSON.stringify({
        model: body.model, status: 'completed',
        output: [{ type: 'message', role: 'assistant',
          content: [{ type: 'output_text', text: JSON.stringify(data) }] }],
        usage: { input_tokens: 200, output_tokens: 35 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  });
  const result = await lab.answerPrivateConversation(raw);
  assert.equal(calls, 2);
  assert.equal(result.status, 'needs_confirmation');
  assert.deepEqual(result.modelIds, []);
  assert.equal(result.publicReady, false);
  assert.equal(result.operationalEffects, false);
  assert.ok(!JSON.stringify(result).includes(claims[0]));
});

test('R327 independent HTTP egress rejects a forged read-access claim', async () => {
  let calls = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    reviewToken: token, enablePrivateConversation: true,
    lab: {
      inspect: () => ({ calls }),
      answer: async () => { throw new Error('unexpected dispatch'); },
      answerPrivateConversation: async () => {
        calls++;
        return { status: 'general_answer', text: claims[1], sourceIds: [],
          modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
          publicReady: false, operationalEffects: false };
      }
    }
  });
  try {
    const res = await fetch(server.address + '/__faisca_openai_private/converse', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify([true, question]), signal: AbortSignal.timeout(5000)
    });
    assert.equal(res.status, 503);
    const value = await res.json();
    assert.equal(value.status, 'unavailable');
    assert.ok(!JSON.stringify(value).includes(claims[1]));
    assert.equal(calls, 1);
  } finally { await server.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPrivateOperationalClaim, safePrivateGeneralReply
} from '../ops/faisca/openai/private-conversation-policy.mjs';
import {
  createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS
} from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const bearer = 'R106_SYNTHETIC_PRIVATE_ACTION_REVIEW_TOKEN_123';
const question = 'Uma landing page ajuda a divulgar eventos?';
const urlPath = '/__faisca_openai_private/converse';
const safe = 'Uma landing page pode divulgar um evento e apresentar informações gerais sem realizar ações.';
const claims = [
  'Já publiquei seu site e configurei seu domínio.',
  'Seu site já está publicado e pode receber visitantes.',
  'Sua campanha está ativa e pronta para receber contatos.',
  'A publicação do seu site foi concluída.',
  'Seu domínio foi configurado no DNS.'
];

async function post(server, text = question) {
  return fetch(server.address + urlPath, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, text])
  });
}

test('R106 conservative operational-claim policy blocks fabricated completion without hurting generic advice', () => {
  for (const claim of claims) {
    assert.equal(hasPrivateOperationalClaim(claim), true, claim);
    assert.equal(safePrivateGeneralReply(claim), false, claim);
  }
  assert.equal(hasPrivateOperationalClaim(safe), false);
  assert.equal(safePrivateGeneralReply(safe), true);
  assert.equal(safePrivateGeneralReply('Você pode publicar uma página após revisar o conteúdo.'), true);
  assert.equal(hasPrivateOperationalClaim(null), true);
  assert.equal(safePrivateGeneralReply(null), false);
});

test('R106 HTTP egress rejects forged general answers asserting finished operations', async t => {
  let output = safe, calls = 0;
  const lab = {
    answer: async () => { throw new Error('Unused fixed synthetic endpoint'); },
    answerPrivateConversation: async () => {
      calls++;
      return {
        status: 'general_answer', text: output, sourceIds: [],
        modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
        operationalEffects: false, publicReady: false
      };
    },
    inspect: () => ({ calls })
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: bearer, enablePrivateConversation: true
  });
  t.after(() => server.close());
  for (const claim of claims) {
    output = claim;
    const result = await post(server);
    assert.equal(result.status, 503, claim);
    const wire = await result.text();
    assert.match(wire, /"status":"unavailable"/);
    assert.equal(wire.includes(claim), false);
  }
  output = safe;
  const valid = await post(server);
  assert.equal(valid.status, 200);
  const envelope = await valid.json();
  assert.equal(envelope.answer, safe);
  assert.equal(envelope.operationalEffects, false);
  assert.equal(envelope.publicReady, false);
  assert.equal(calls, claims.length + 1);
});

test('R106 real private lab adapter with synthetic Luna/Terra fixtures falls back on fabricated action', async t => {
  let dispatches = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-R106_SYNTHETIC_ONLY_NEVER_REAL_1234567',
    enablePrivateConversation: true,
    extendedPrivateSession: true, maxRequests: 4, maxBudgetUsd: 1,
    fetchImpl: async (_url, init) => {
      dispatches++;
      const { model, store, tools } = JSON.parse(init.body);
      assert.equal(store, false);
      assert.deepEqual(tools, []);
      const payload = model === FAISCA_OPENAI_MODELS.classification
        ? { topic: 'general' } : { reply: claims[0] };
      return new Response(JSON.stringify({
        model, status: 'completed',
        output: [{ type: 'message', role: 'assistant',
          content: [{ type: 'output_text', text: JSON.stringify(payload) }] }],
        usage: { input_tokens: 100, output_tokens: 30 }
      }), { headers: { 'Content-Type': 'application/json' } });
    }
  });
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: bearer, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const result = await post(server);
  assert.equal(result.status, 200);
  const envelope = await result.json();
  assert.equal(envelope.status, 'needs_confirmation');
  assert.equal(envelope.answer, 'Essa informação precisa ser confirmada com a equipe da Imagine.');
  assert.deepEqual(envelope.models, []);
  assert.deepEqual(envelope.sources, []);
  assert.equal(envelope.operationalEffects, false);
  assert.equal(envelope.publicReady, false);
  assert.equal(dispatches, 2, 'No additional external calls or action tools');
  assert.equal(lab.inspect().calls, 2);
});

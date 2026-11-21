import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPrivateUnsupportedOutcomeGuarantee, safePrivateGeneralReply
} from '../ops/faisca/openai/private-conversation-policy.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';

const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const allowed = 'Uma landing page pode apresentar as informações principais de um evento de forma simples.';
const unsupported = [
  'Em geral, 83% dos usuários preferem uma landing page mais curta.',
  'Sites de eventos podem gerar 40 inscrições adicionais por semana.',
  'Pesquisas recentes mostram que páginas curtas geram mais vendas.',
  'Segundo especialistas, as landing pages curtas sempre ajudam a vender.',
  'Um levantamento independente indica ganhos de desempenho nessas páginas.'
];
const token = 'R201_PRIVATE_SYNTHETIC_HTTP_REVIEW_TOKEN_123456';

test('R201 conservative editorial egress rejects unsourced statistics and anonymous research', () => {
  assert.equal(hasPrivateUnsupportedOutcomeGuarantee(allowed), false);
  assert.equal(safePrivateGeneralReply(allowed), true);
  for (const text of unsupported) {
    assert.equal(hasPrivateUnsupportedOutcomeGuarantee(text), true, text);
    assert.equal(safePrivateGeneralReply(text), false, text);
  }
});

test('R201 HTTP loopback rejects injected unsupported claims but accepts grounded-neutral prose', async t => {
  let draft = unsupported[0], calls = 0;
  const lab = {
    answer: () => { throw new Error('not a fixed-case test'); },
    inspect: () => Object.freeze({ schema: 'r201-synthetic', publicReady: false, operationalEffects: false }),
    answerPrivateConversation: async () => {
      calls++;
      return {
        status: 'general_answer', text: draft,
        sourceIds: [],
        modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
        publicReady: false, operationalEffects: false
      };
    }
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, question])
  });
  for (const claim of unsupported) {
    draft = claim;
    const response = await post();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    const payload = await response.text();
    assert.equal(JSON.parse(payload).status, 'unavailable');
    assert.doesNotMatch(payload, /landing page|inscri|pesquis|estud|especialist|R201_PRIVATE|83%|40/i);
    assert.equal(server.inspect().providerUnavailable, false);
  }
  draft = allowed;
  const accepted = await post();
  assert.equal(accepted.status, 200);
  const payload = await accepted.json();
  assert.equal(payload.answer, allowed);
  assert.equal(payload.status, 'general_answer');
  assert.deepEqual(payload.sources, []);
  assert.equal(payload.sourceRecipeBound, false);
  assert.equal(payload.publicReady, false);
  assert.equal(payload.operationalEffects, false);
  assert.equal(calls, unsupported.length + 1);
});

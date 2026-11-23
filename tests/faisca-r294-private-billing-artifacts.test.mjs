import test from 'node:test';
import assert from 'node:assert/strict';
import {
  privateConversationRoute, safePrivateGeneralReply,
  PRIVATE_CONVERSATION_CONFIRMATION_TEXT
} from '../ops/faisca/openai/private-conversation-policy.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS }
  from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview }
  from '../ops/faisca/openai/private-review-http.mjs';

const questions = Object.freeze([
  'Meu boleto ja foi emitido?',
  'A nota fiscal esta disponivel?',
  'Posso receber um recibo?',
  'Minha fatura foi quitada?',
  'O Pix foi confirmado?'
]);
const unsupported = Object.freeze([
  'Seu boleto ja foi emitido.',
  'A nota fiscal esta disponivel.',
  'Seu recibo ja esta pronto.',
  'A fatura foi quitada.',
  'O Pix foi confirmado.'
]);
const neutral = 'Uma landing page pode explicar os servicos com clareza.';

test('R294 private billing-document status never spends model quota', async () => {
  let invocations = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-r294-FAKE-fixture-never-sent-1234567890',
    enablePrivateConversation: true, extendedPrivateSession: true,
    maxBudgetUsd: 10, maxRequests: 20,
    fetchImpl: async () => { invocations++; throw Error('UNEXPECTED_PAID_PROVIDER'); }
  });
  for (const question of questions) {
    assert.equal(privateConversationRoute(question), 'confirm', question);
    const result = await lab.answerPrivateConversation({
      scope: 'local_operator_lab', attestedSynthetic: true, question
    });
    // Earlier preflight may conservatively refuse a billing-like question.
    // Either denial or deterministic confirmation is safe; neither may spend.
    if (result !== null) {
      assert.equal(result.status, 'needs_confirmation', question);
      assert.equal(result.text, PRIVATE_CONVERSATION_CONFIRMATION_TEXT);
      assert.deepEqual(result.modelIds, []);
      assert.equal(result.publicReady, false);
      assert.equal(result.operationalEffects, false);
    }
  }
  assert.equal(invocations, 0);
  assert.equal(lab.inspect().calls, 0);
  assert.equal(privateConversationRoute('Como deixar uma landing page mais clara?'), 'classify');
});

test('R294 private model cannot invent issued invoices, bills, receipts or Pix clearance', () => {
  for (const claim of unsupported) {
    assert.equal(safePrivateGeneralReply(claim), false, claim);
  }
  assert.equal(safePrivateGeneralReply(neutral), true);
});

test('R294 HTTP blocks fabricated billing receipt without exposing prose, allows neutral fictional reply', async t => {
  let unsafe = true;
  const lab = {
    inspect: () => Object.freeze({ syntheticOnly: true }),
    answer: async () => { throw Error('UNEXPECTED_FIXED_CASE'); },
    answerPrivateConversation: async () => ({
      status: 'general_answer',
      text: unsafe ? unsupported[0] : neutral,
      sourceIds: [],
      modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
      publicReady: false, operationalEffects: false
    })
  };
  const token = 'R294_SYNTHETIC_PRIVATE_REVIEW_TOKEN_ONLY_123456';
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', redirect: 'error', cache: 'no-store', credentials: 'omit',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, 'Como deixar uma landing page mais clara?'])
  });
  const blocked = await post();
  assert.equal(blocked.status, 503);
  const body = await blocked.text();
  assert.equal(JSON.parse(body).status, 'unavailable');
  assert.equal(body.includes(unsupported[0]), false);
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  assert.equal(blocked.headers.get('set-cookie'), null);
  unsafe = false;
  const allowed = await post();
  assert.equal(allowed.status, 200);
  const result = await allowed.json();
  assert.equal(result.status, 'general_answer');
  assert.equal(result.answer, neutral);
  assert.equal(result.publicReady, false);
  assert.equal(result.operationalEffects, false);
});

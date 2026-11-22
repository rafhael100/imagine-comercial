import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPrivateIdentifierRisk } from '../ops/faisca/openai/private-identifier-risk.mjs';
import { safePrivateGeneralReply } from '../ops/faisca/openai/private-conversation-policy.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// All strings are invented; zero customer data, external calls or credentials.
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const safe = 'Uma landing page pode organizar o conteúdo de um evento fictício.';
const bearer = 'R208_PRIVATE_SYNTHETIC_REVIEW_TOKEN_2026';
const unsafe = [
  'Consulte exemplo.teste para conhecer dicas de páginas.',
  'O atendimento fictício usa o número 11987654321 para mensagens.',
  'Uma página fictícia está disponível em 127.1 para testes.',
  'Um identificador fictício sk-' + 'a'.repeat(28) + ' pode ser utilizado.',
  'Consulte https://exemplo.invalid para encontrar sugestões.'
];

test('R208 server and browser parity fixture: bare identifiers are unsafe', () => {
  for (const candidate of unsafe) {
    assert.equal(hasPrivateIdentifierRisk(candidate), true, 'Known sensitive shape must fail closed');
    assert.equal(safePrivateGeneralReply(candidate), false);
  }
  assert.equal(hasPrivateIdentifierRisk(safe), false);
  assert.equal(safePrivateGeneralReply(safe), true);
});

test('R208 private HTTP refuses forged identifier shapes without leaking text', async t => {
  let reply = safe, fakeCalls = 0;
  const lab = {
    answer: async () => { throw new Error('No fixed case in this synthetic test'); },
    answerPrivateConversation: async () => {
      fakeCalls++;
      return {
        status: 'general_answer', text: reply, sourceIds: [],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra'],
        publicReady: false, operationalEffects: false
      };
    },
    inspect: () => ({ syntheticOnly: true, paidModelCalls: 0 })
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: bearer, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, question])
  });
  for (const candidate of unsafe) {
    reply = candidate;
    const response = await post();
    assert.equal(response.status, 503, 'Unsafe synthetic reply must never be shown');
    const body = await response.json();
    assert.equal(body.status, 'unavailable');
    assert.equal(body.publicReady, undefined);
    assert.doesNotMatch(JSON.stringify(body), /exemplo\.teste|11987654321|127\.1|sk-|exemplo\.invalid/u);
  }
  reply = safe;
  const response = await post();
  assert.equal(response.status, 200);
  const accepted = await response.json();
  assert.equal(accepted.answer, safe);
  assert.equal(accepted.publicReady, false);
  assert.equal(accepted.operationalEffects, false);
  assert.equal(fakeCalls, unsafe.length + 1);
  assert.equal(server.inspect().providerUnavailable, false);
});

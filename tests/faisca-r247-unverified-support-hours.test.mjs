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
  'O atendimento funciona aos sabados?',
  'O suporte está disponível nos feriados?',
  'Atendimento funciona durante a madrugada?',
  'O plantão atende durante a noite?'
]);
const generalQuestion = 'Como organizar a comunicação de uma landing page fictícia?';
const synthetic = question => ({ scope: 'local_operator_lab',
  attestedSynthetic: true, question });

test('R247 service-hour questions receive fixed confirmation without provider spend', async () => {
  let providerCalls = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true,
    apiKey: 'sk-r247-synthetic-fixture-only-1234567890',
    enablePrivateConversation: true,
    extendedPrivateSession: true, maxBudgetUsd: 10, maxRequests: 20,
    fetchImpl: async () => { providerCalls++; throw Error('UNEXPECTED_PROVIDER'); }
  });
  for (const question of questions) {
    assert.equal(privateConversationRoute(question), 'confirm', question);
    const response = await lab.answerPrivateConversation(synthetic(question));
    assert.ok(response, question);
    assert.equal(response.status, 'needs_confirmation');
    assert.equal(response.text, PRIVATE_CONVERSATION_CONFIRMATION_TEXT);
    assert.deepEqual(response.modelIds, []);
    assert.deepEqual(response.sourceIds, []);
    assert.equal(response.publicReady, false);
    assert.equal(response.operationalEffects, false);
  }
  assert.equal(providerCalls, 0);
  assert.equal(lab.inspect().calls, 0);
  assert.equal(privateConversationRoute(generalQuestion), 'classify');
});

test('R247 first-person service availability cannot be fabricated by a model', () => {
  for (const claim of [
    'Atendemos aos domingos e feriados sem custo adicional.',
    'Respondemos durante toda a madrugada com nossa equipe.',
    'Estamos disponíveis todos os dias para orientar visitantes.',
    'Funcionamos aos sábados e durante a noite.',
    'O atendimento está disponível em qualquer horário.'
  ]) assert.equal(safePrivateGeneralReply(claim), false, claim);
  for (const neutral of [
    'Uma landing page pode apresentar detalhes de um evento fictício.',
    'É possível organizar atendimento em canais digitais com regras claras.',
    'Você pode revisar um conteúdo antes de publicá-lo.'
  ]) assert.equal(safePrivateGeneralReply(neutral), true, neutral);
});

test('R247 HTTP egress gives generic 503 for invented timetable, retains neutral reply', async t => {
  let claimed = true;
  const lab = {
    inspect: () => ({ syntheticOnly: true }),
    answer: async () => { throw Error('UNEXPECTED_FIXED_CASE'); },
    answerPrivateConversation: async () => ({
      status: 'general_answer',
      text: claimed
        ? 'Atendemos aos domingos e feriados sem custo adicional.'
        : 'Uma landing page pode apresentar detalhes de um evento fictício.',
      sourceIds: [],
      modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
      publicReady: false, operationalEffects: false
    })
  };
  const reviewToken = 'R247_SYNTHETIC_REVIEW_TOKEN_012345678901234567';
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store',
    headers: { Authorization: 'Bearer ' + reviewToken, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, generalQuestion])
  });
  const blocked = await post();
  assert.equal(blocked.status, 503);
  const text = await blocked.text();
  assert.equal(JSON.parse(text).status, 'unavailable');
  assert.doesNotMatch(text, /atendemos|domingos|feriados/i);
  assert.equal(blocked.headers.get('set-cookie'), null);
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  claimed = false;
  const allowed = await post();
  assert.equal(allowed.status, 200);
  const body = await allowed.json();
  assert.equal(body.status, 'general_answer');
  assert.equal(body.publicReady, false);
  assert.equal(body.operationalEffects, false);
});

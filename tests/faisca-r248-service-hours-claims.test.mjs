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

// Reversed questions are about the operator's schedule, not anonymous
// advice. Use only fictional words; nothing is forwarded to a paid API.
const supportHours = Object.freeze([
  'Qual é o horário do atendimento?',
  'Até que horas funciona o suporte?',
  'Tem plantão nos feriados?',
  'Existe atendimento hoje?',
  'Quando a assistência está disponível?',
  'Posso usar suporte aos sábados?'
]);
const synthetic = question => ({
  scope: 'local_operator_lab', attestedSynthetic: true, question
});
const generalQuestion = 'Vale a pena usar uma landing page para divulgar um evento?';

test('R248 reverse-order service timetable questions do not spend provider requests', async () => {
  let fetchCalls = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-r248-synthetic-fixture-only-1234567890',
    enablePrivateConversation: true,
    extendedPrivateSession: true, maxBudgetUsd: 10, maxRequests: 20,
    fetchImpl: async () => { fetchCalls++; throw Error('UNEXPECTED_PROVIDER'); }
  });
  for (const question of supportHours) {
    assert.equal(privateConversationRoute(question), 'confirm', question);
    const result = await lab.answerPrivateConversation(synthetic(question));
    assert.equal(result?.status, 'needs_confirmation', question);
    assert.equal(result.text, PRIVATE_CONVERSATION_CONFIRMATION_TEXT);
    assert.deepEqual(result.modelIds, []);
    assert.deepEqual(result.sourceIds, []);
    assert.equal(result.publicReady, false);
    assert.equal(result.operationalEffects, false);
  }
  assert.equal(fetchCalls, 0);
  assert.equal(lab.inspect().calls, 0);
  assert.equal(privateConversationRoute(generalQuestion), 'classify');
  assert.equal(privateConversationRoute('Como melhorar atendimento digital em uma campanha?'), 'classify');
});

test('R248 free model replies cannot claim third-person service hours or capacity', () => {
  for (const text of [
    'O suporte está disponível aos domingos.',
    'O plantão funciona nos feriados.',
    'A assistência fica online agora.',
    'Temos suporte durante a madrugada.',
    'A equipe atende aos sábados.'
  ]) {
    assert.equal(safePrivateGeneralReply(text), false, text);
  }
  for (const text of [
    'Uma landing page pode explicar canais de atendimento de forma clara.',
    'É possível planejar suporte digital sem assumir horários de serviço.',
    'Você pode revisar o conteúdo da página antes de publicá-lo.'
  ]) {
    assert.equal(safePrivateGeneralReply(text), true, text);
  }
});

test('R248 HTTP rejects invented service availability without leaking it', async t => {
  let claimed = true;
  const lab = {
    inspect: () => ({ syntheticOnly: true }),
    answer: async () => { throw Error('UNEXPECTED_CASE'); },
    answerPrivateConversation: async () => ({
      status: 'general_answer',
      text: claimed
        ? 'O suporte está disponível aos domingos.'
        : 'Uma landing page pode explicar canais de atendimento de forma clara.',
      sourceIds: [],
      modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
      publicReady: false, operationalEffects: false
    })
  };
  const token = 'R248_SYNTHETIC_REVIEW_TOKEN_012345678901234567';
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const post = question => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', redirect: 'error', cache: 'no-store', credentials: 'omit',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, question])
  });
  let blocked = await post(generalQuestion);
  assert.equal(blocked.status, 503);
  let body = await blocked.text();
  assert.equal(JSON.parse(body).status, 'unavailable');
  assert.doesNotMatch(body, /suporte|domingos|dispon.vel/i);
  assert.equal(blocked.headers.get('set-cookie'), null);
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  // An untrusted adapter cannot bypass the question router by fabricating
  // a generic answer for an operator availability question.
  claimed = false;
  blocked = await post(supportHours[0]);
  assert.equal(blocked.status, 503);
  assert.equal((await blocked.json()).status, 'unavailable');
  const allowed = await post(generalQuestion);
  assert.equal(allowed.status, 200);
  body = await allowed.json();
  assert.equal(body.status, 'general_answer');
  assert.equal(body.publicReady, false);
  assert.equal(body.operationalEffects, false);
});

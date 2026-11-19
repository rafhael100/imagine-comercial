import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSupportJourney, respondSupportJourney, getSupportJourneySummary,
  SUPPORT_JOURNEY_VERSION
} from '../ops/faisca/support/journey.mjs';

const choose = (session, id) => respondSupportJourney(session, { type: 'action', id });
const say = (session, text) => respondSupportJourney(session, { type: 'text', text });

function completed() {
  let session = createSupportJourney();
  for (const id of ['r10:topic:technical', 'r10:service:onepage', 'r10:detail:contact_form']) {
    const result = choose(session, id);
    assert.ok(result.session);
    session = result.session;
  }
  return session;
}

test('R10 journey starts anonymously, with after-sales-only summary and no verified customer', () => {
  const session = createSupportJourney();
  assert.equal(session.version, SUPPORT_JOURNEY_VERSION);
  assert.equal(session.journey, 'after_sales');
  assert.equal(session.supportTopic, null);
  assert.deepEqual(session.selection, []);
  assert.equal(session.goal, null);
  const summary = getSupportJourneySummary(session);
  assert.match(summary, /RASCUNHO NÃO ENVIADO/);
  assert.match(summary, /Não informado/);
  assert.match(summary, /Nenhum ticket foi aberto/);
});

test('R10 support path opens from the reviewed after_sales button', () => {
  const session = createSupportJourney();
  const result = choose(session, 'after_sales');
  assert.equal(result.reply.intent, 'r10_support_question');
  assert.match(result.reply.text, /Qual é o assunto/);
  assert.deepEqual(result.reply.actions.map(action => action.id), [
    'r10:topic:delivery', 'r10:topic:technical', 'r10:topic:billing',
    'r10:topic:cancellation', 'r10:topic:general', 'r10:summary'
  ]);
  assert.equal(result.session.triage.topic, null);
});

test('R10 support journey progresses one closed choice at a time without calling CRM', () => {
  let session = createSupportJourney();
  let result = choose(session, 'r10:topic:billing');
  assert.equal(result.session.supportTopic, 'billing');
  assert.match(result.reply.text, /A qual serviço/);
  assert.equal(result.reply.actions.length, 6);
  session = result.session;
  result = choose(session, 'r10:service:crm');
  assert.match(result.reply.text, /Qual destas opções/);
  assert.ok(result.reply.actions.some(item => item.id === 'r10:detail:invoice'));
  session = result.session;
  result = choose(session, 'r10:detail:invoice');
  assert.equal(result.reply.intent, 'r10_support_complete');
  assert.match(result.reply.text, /RESUMO DE SUPORTE/);
  assert.match(result.reply.text, /Nenhum ticket foi aberto/);
  assert.match(result.reply.text, /Imagine CRM/);
  assert.match(result.reply.text, /Nota fiscal/);
  assert.equal(result.reply.sources.length, 0);
  assert.equal(result.session.triage.detail, 'invoice');
});

test('R10 typed data, even secrets, is never echoed or stored in the support profile', () => {
  const session = createSupportJourney();
  const privateText = 'Minha senha TOP_SECRET_123, contato pessoa@example.invalid';
  const result = say(session, privateText);
  assert.equal(result.userText, '[Mensagem livre não registrada]');
  assert.equal(result.reply.intent, 'r10_support_question');
  assert.match(result.reply.text, /aceita apenas as opções disponíveis/);
  assert.doesNotMatch(result.reply.text, /TOP_SECRET_123|example\.invalid/);
  assert.doesNotMatch(getSupportJourneySummary(result.session), /TOP_SECRET_123|example\.invalid/);
  assert.equal(result.session.triage.topic, null);
});

test('R10 correction clears only chosen field and dependent answers', () => {
  const session = completed();
  const before = getSupportJourneySummary(session);
  const corrected = choose(session, 'r10:revise:service');
  assert.equal(corrected.session.triage.topic, 'technical');
  assert.equal(corrected.session.triage.service, null);
  assert.equal(corrected.session.triage.detail, null);
  assert.match(corrected.reply.text, /A qual serviço/);
  assert.equal(session.triage.detail, 'contact_form');
  assert.match(before, /Dificuldade com formulário/);
  assert.doesNotMatch(getSupportJourneySummary(corrected.session), /Dificuldade com formulário/);
});

test('R10 partial summary does not claim a ticket was opened and retains next choices', () => {
  const start = choose(createSupportJourney(), 'r10:topic:delivery');
  const result = choose(start.session, 'r10:summary');
  assert.match(result.reply.text, /RASCUNHO NÃO ENVIADO/);
  assert.match(result.reply.text, /Você pode continuar escolhendo uma opção/);
  assert.ok(result.reply.actions.some(item => item.id === 'r10:service:onepage'));
  assert.equal(result.session.triage.service, null);
});

test('R10 explicit restart clears only the local triage, not an external ticket', () => {
  const result = choose(completed(), 'r10:restart');
  assert.equal(result.session.triage.topic, null);
  assert.equal(result.session.triage.detail, null);
  assert.match(result.reply.text, /Nenhum ticket foi criado/);
  assert.match(getSupportJourneySummary(result.session), /RASCUNHO NÃO ENVIADO/);
});

test('R10 refuses future-field choices and unapproved actions', () => {
  const initial = createSupportJourney();
  const incorrectOrder = choose(initial, 'r10:detail:contact_form');
  assert.equal(incorrectOrder.session.triage.topic, null);
  assert.match(incorrectOrder.reply.text, /pergunta atual/);
  const unknown = choose(initial, 'crm.write');
  assert.match(unknown.reply.text, /não está disponível/);
  assert.equal(initial.triage.topic, null);
});

test('R10 sessions reject clones and refuse accessors without executing them', () => {
  const session = createSupportJourney();
  const cloned = choose({ ...session }, 'r10:topic:billing');
  assert.match(cloned.reply.text, /não pôde ser validado/);
  assert.equal(cloned.session.triage.topic, null);
  let reads = 0;
  const accessor = { type: 'action', get id() { reads++; return 'r10:topic:billing'; } };
  const result = respondSupportJourney(session, accessor);
  assert.equal(reads, 0);
  assert.equal(result.session.triage.topic, null);
});

test('R10 concurrent local support flows never share customer context or service choices', () => {
  const a = choose(createSupportJourney(), 'r10:topic:technical').session;
  const b = choose(createSupportJourney(), 'r10:topic:billing').session;
  const aService = choose(a, 'r10:service:onepage').session;
  const bService = choose(b, 'r10:service:crm').session;
  assert.equal(aService.triage.topic, 'technical');
  assert.equal(bService.triage.topic, 'billing');
  assert.equal(aService.triage.service, 'onepage');
  assert.equal(bService.triage.service, 'crm');
  assert.equal(b.triage.service, null);
  assert.doesNotMatch(getSupportJourneySummary(aService), /Imagine CRM/);
});

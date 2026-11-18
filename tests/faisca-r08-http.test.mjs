import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConversationRequest, CONVERSATION_SCHEMA } from '../ops/faisca/conversation-contract.mjs';
import { createQualificationPrepareTurn } from '../ops/faisca/qualification/http-runtime.mjs';
import { getQualificationSummary } from '../ops/faisca/qualification/journey.mjs';

function request(input, messageId = 'r08_http_message_0001', conversationId = 'a'.repeat(32)) {
  return validateConversationRequest({
    schema: CONVERSATION_SCHEMA, conversationId, messageId, locale: 'pt-BR', input
  });
}

test('R08 HTTP contract accepts only the closed qualification actions', () => {
  for (const id of [
    'confirm_goal', 'cancel_goal', 'r08:summary', 'r08:change_service', 'r08:restart',
    'r08:edit:objective', 'r08:edit:audience', 'r08:edit:materials',
    'r08:edit:timeline', 'r08:edit:contactConsent',
    'r08:objective:present_company', 'r08:objective:capture_leads',
    'r08:audience:businesses', 'r08:materials:ready',
    'r08:timeline:within_30_days', 'r08:contactConsent:granted'
  ]) assert.ok(request({ type: 'action', id }), id);
  for (const id of ['r08:objective:email', 'r08:contactConsent:phone',
    'r08:service:crm', 'r08:edit:email', 'r08:unknown']) {
    assert.equal(request({ type: 'action', id }), null, id);
  }
});

test('R08 HTTP prepare factory requires a server-issued opaque conversation ID', () => {
  for (const value of [null, '', 'short', 'g'.repeat(32), 'a'.repeat(31)]) {
    assert.throws(() => createQualificationPrepareTurn(value), TypeError);
  }
  assert.equal(typeof createQualificationPrepareTurn('a'.repeat(32)), 'function');
});

test('R08 HTTP session keeps proposal and qualification local, then exposes only the R07 answer as provider candidate', () => {
  const prepare = createQualificationPrepareTurn('a'.repeat(32));
  let result = prepare(null, { type: 'text', text: 'Quero apresentar minha empresa.' });
  assert.equal(result.reply.intent, 'journey_confirmation_needed');
  assert.equal(result.providerReply, undefined);
  let session = result.session;

  result = prepare(session, { type: 'action', id: 'confirm_goal' });
  assert.equal(result.reply.intent, 'r08_qualification_question');
  assert.equal(result.providerReply.intent, 'goal_presence');
  assert.match(result.reply.text, /Qual é o principal resultado/);
  session = result.session;

  result = prepare(session, { type: 'action', id: 'r08:objective:present_company' });
  assert.equal(result.reply.intent, 'r08_qualification_question');
  assert.equal(result.providerReply, undefined);
  assert.match(result.reply.text, /Quem você deseja alcançar/);
  assert.match(getQualificationSummary(result.session), /Site Onepage/);
});

test('R08 HTTP grounded FAQ retains the R08 profile while the PHP candidate stays exact R07 editorial text', () => {
  const prepare = createQualificationPrepareTurn('b'.repeat(32));
  let result = prepare(null, { type: 'action', id: 'goal_campaign' });
  assert.equal(result.reply.intent, 'journey_confirmation_needed');
  result = prepare(result.session, { type: 'action', id: 'confirm_goal' });
  assert.equal(result.providerReply.intent, 'goal_campaign');
  let session = result.session;
  for (const [field, value] of [
    ['objective', 'capture_leads'], ['audience', 'businesses'],
    ['materials', 'ready'], ['timeline', 'within_90_days'], ['contactConsent', 'declined']
  ]) session = prepare(session, { type: 'action', id: 'r08:' + field + ':' + value }).session;
  result = prepare(session, { type: 'text', text: 'Como funciona o projeto?' });
  assert.equal(result.reply.intent, 'r08_qualification_complete');
  assert.equal(result.providerReply.intent, 'process');
  assert.match(result.reply.text, /Como funciona o projeto/);
  assert.match(result.reply.text, /RASCUNHO NÃO ENVIADO/);
  assert.match(getQualificationSummary(result.session), /Landing Page/);
  assert.match(getQualificationSummary(result.session), /Não autorizou/);
});

test('R08 HTTP factories isolate confirmed services and profile state between sessions', () => {
  const prepareA = createQualificationPrepareTurn('a'.repeat(32));
  const prepareB = createQualificationPrepareTurn('b'.repeat(32));
  let a = prepareA(null, { type: 'text', text: 'Quero apresentar minha empresa.' });
  let b = prepareB(null, { type: 'action', id: 'goal_campaign' });
  a = prepareA(a.session, { type: 'action', id: 'confirm_goal' });
  b = prepareB(b.session, { type: 'action', id: 'confirm_goal' });
  a = prepareA(a.session, { type: 'action', id: 'r08:objective:present_company' });
  b = prepareB(b.session, { type: 'action', id: 'r08:objective:capture_leads' });
  assert.match(getQualificationSummary(a.session), /Site Onepage/);
  assert.match(getQualificationSummary(b.session), /Landing Page/);
  assert.match(getQualificationSummary(a.session), /Apresentar a empresa/);
  assert.match(getQualificationSummary(b.session), /Captar contatos/);
  assert.doesNotMatch(getQualificationSummary(a.session), /Landing Page/);
  assert.doesNotMatch(getQualificationSummary(b.session), /Site Onepage/);
});

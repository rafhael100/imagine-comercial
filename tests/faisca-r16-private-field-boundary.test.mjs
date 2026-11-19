import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond } from '../ops/faisca/core.mjs';
import { createQualificationJourney, respondQualificationJourney } from '../ops/faisca/qualification/journey.mjs';
import { prepareFieldRouteRequest, routeFieldWithLocalFixture } from '../ops/faisca/model-router/field-contract.mjs';

const cases = Object.freeze([
  ['support_cancel', 'objective', 'Quero cancelar meu contrato e captar leads depois.'],
  ['support_billing', 'materials', 'Preciso da segunda via do recibo e já tenho textos e imagens.'],
  ['support_issue', 'objective', 'Meu site não funciona e quero apresentar minha empresa.'],
  ['after_sales', 'materials', 'Preciso entrar no Portal e já tenho textos e imagens.'],
  ['support_billing', 'objective', 'O valor do meu plano atual está alto, quero captar leads.'],
  ['human', 'objective', 'Quero falar com um atendente e captar leads.'],
  ['privacy', 'objective', 'Tenho dúvidas sobre privacidade e quero captar leads.']
]);
const request = (text, field, index) => ({
  conversationId: 'r16_private_scope_conversation',
  messageId: 'r16_private_field_' + index, userText: text, field
});

test('R16 private-account and support requests cannot silently populate commercial fields', () => {
  for (const [index, [expectedIntent, field, text]] of cases.entries()) {
    const coreReply = respond(createSession(), { type: 'text', text });
    assert.equal(coreReply.reply.intent, expectedIntent, text);
    const options = request(text, field, index);
    assert.equal(prepareFieldRouteRequest(options), null, text);
    const routed = routeFieldWithLocalFixture(options);
    assert.equal(routed.accepted, false, text);
    assert.equal(routed.status, 'refused', text);
    assert.equal(routed.value, null, text);
    assert.equal(routed.reason, 'request_refused', text);
    assert.equal('request' in routed, false, text);
  }
});

test('R16 a private request does not change an existing R08 qualification profile', () => {
  const action = (session, id) => respondQualificationJourney(session, { type: 'action', id });
  const text = (session, value) => respondQualificationJourney(session, { type: 'text', text: value });
  let step = text(createQualificationJourney(), 'Quero apresentar minha empresa.');
  step = action(step.session, 'confirm_goal');
  step = action(step.session, 'r08:objective:present_company');
  const profile = step.session.profile;
  const blocked = text(step.session, 'Preciso da segunda via do recibo e já tenho textos e imagens.');
  assert.equal(blocked.session.profile, profile);
  assert.equal(blocked.session.profile.materials, null);
  assert.equal(blocked.session.profile.objective, 'present_company');
  assert.deepEqual(blocked.reply.sources, []);
  assert.match(blocked.reply.text, /Quem você deseja alcançar/);
});

test('R16 ordinary, non-private site qualification answers still map to fixed enums', () => {
  const ordinary = [
    ['objective', 'Quero captar leads interessados.', 'capture_leads'],
    ['materials', 'Já tenho textos e imagens.', 'ready'],
    ['timeline', 'Quero iniciar nos próximos 30 dias.', 'within_30_days'],
    ['contactConsent', 'Não autorizo contato.', 'declined']
  ];
  for (const [index, [field, text, value]] of ordinary.entries()) {
    const outcome = routeFieldWithLocalFixture(request(text, field, 'public_' + index));
    assert.equal(outcome.accepted, true, text);
    assert.equal(outcome.status, 'matched', text);
    assert.equal(outcome.value, value, text);
  }
});

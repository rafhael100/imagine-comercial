import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQualificationJourney, respondQualificationJourney, getQualificationSummary
} from '../ops/faisca/qualification/journey.mjs';

const action = (session, id) => respondQualificationJourney(session, { type: 'action', id });
const text = (session, value) => respondQualificationJourney(session, { type: 'text', text: value });
function start() {
  const proposed = action(createQualificationJourney(), 'goal_presence');
  assert.equal(proposed.session.profile, null);
  const confirmed = action(proposed.session, 'confirm_goal');
  assert.equal(confirmed.session.phase, 'qualification');
  return confirmed.session;
}

test('R56 matched natural-language answers only display verified closed labels', () => {
  const secret = 'CODIGO_SINTETICO_R56_NAO_ECOAR';
  const initial = start();
  const result = text(initial, 'Quero captar leads interessados. ' + secret);
  assert.equal(result.session.profile.objective, 'capture_leads');
  assert.equal(result.userText, 'Captar contatos interessados');
  assert.match(result.reply.text, /Quem você deseja alcançar/);
  assert.equal(result.reply.sources.length, 0);
  assert.ok(result.session.profile !== initial.profile);
  assert.doesNotMatch(JSON.stringify(result), /CODIGO_SINTETICO_R56_NAO_ECOAR/);
  assert.doesNotMatch(getQualificationSummary(result.session), /CODIGO_SINTETICO_R56_NAO_ECOAR/);
  assert.equal(result.session.profile.email, undefined);
  assert.equal(result.session.profile.phone, undefined);
});

test('R56 ambiguous natural-language answer is discarded and the closed alternatives remain', () => {
  const secret = 'OUTRA_INFORMACAO_NAO_REGISTRAR_R56';
  const first = action(start(), 'r08:objective:present_company');
  const result = text(first.session, 'Quero alcançar outras empresas e consumidores online. ' + secret);
  assert.equal(result.session.profile.audience, null);
  assert.equal(result.userText, '[Resposta ambígua — escolha uma opção]');
  assert.match(result.reply.text, /mais de uma interpretação possível/);
  assert.ok(result.reply.actions.some(item => item.id === 'r08:audience:businesses'));
  assert.ok(result.reply.actions.some(item => item.id === 'r08:audience:online_consumers'));
  assert.doesNotMatch(JSON.stringify(result), /OUTRA_INFORMACAO_NAO_REGISTRAR_R56/);
});

test('R56 contact consent is a closed preference, not visitor contact information', () => {
  let current = start();
  for (const id of [
    'r08:objective:present_company', 'r08:audience:businesses',
    'r08:materials:ready', 'r08:timeline:flexible'
  ]) current = action(current, id).session;
  const secret = 'DADO_NAO_ENVIAR_R56';
  const result = text(current, 'Não autorizo contato. ' + secret);
  assert.equal(result.session.phase, 'complete');
  assert.equal(result.session.profile.contactConsent, 'declined');
  assert.equal(result.userText, 'Não autorizo');
  assert.match(getQualificationSummary(result.session), /Não concedida/);
  assert.equal(result.session.profile.email, undefined);
  assert.doesNotMatch(JSON.stringify(result), /DADO_NAO_ENVIAR_R56/);
  assert.doesNotMatch(getQualificationSummary(result.session), /DADO_NAO_ENVIAR_R56/);
});

test('R56 explicit closed actions still retain selected visible labels', () => {
  const result = action(start(), 'r08:objective:present_company');
  assert.equal(result.session.profile.objective, 'present_company');
  assert.equal(result.userText, 'Apresentar minha empresa');
  assert.match(result.reply.text, /Quem você deseja alcançar/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQualificationJourney, respondQualificationJourney, getQualificationSummary
} from '../ops/faisca/qualification/journey.mjs';

const send = (session, text) => respondQualificationJourney(session, { type: 'text', text });
const choose = (session, id) => respondQualificationJourney(session, { type: 'action', id });

function startOnepage() {
  const first = send(createQualificationJourney(), 'Quero apresentar minha empresa.');
  assert.equal(first.reply.intent, 'journey_confirmation_needed');
  assert.equal(first.session.profile, null);
  const confirmed = choose(first.session, 'confirm_goal');
  assert.equal(confirmed.reply.intent, 'r08_qualification_question');
  assert.equal(confirmed.session.profile.service, 'onepage');
  return confirmed.session;
}

function complete(session, consent = 'granted') {
  let current = session;
  for (const id of [
    'r08:objective:present_company',
    'r08:audience:local_customers',
    'r08:materials:ready',
    'r08:timeline:within_30_days',
    'r08:contactConsent:' + consent
  ]) current = choose(current, id).session;
  return current;
}

test('R08-B does not start qualification until the R07 service is explicitly confirmed', () => {
  const initial = createQualificationJourney();
  const proposed = send(initial, 'Quero Onepage.');
  assert.equal(proposed.session.profile, null);
  assert.equal(proposed.session.phase, 'sales');
  assert.match(proposed.reply.text, /Confirme a escolha/);
  const confirmed = choose(proposed.session, 'confirm_goal');
  assert.equal(confirmed.session.profile.service, 'onepage');
  assert.equal(confirmed.session.phase, 'qualification');
  assert.match(confirmed.reply.text, /Qual é o principal resultado/);
});

test('R08-B asks one question at a time and records only the selected closed options', () => {
  let session = startOnepage();
  assert.deepEqual(session.profile.objective, null);
  assert.equal(session.profile.contactConsent, 'not_asked');
  session = choose(session, 'r08:objective:capture_leads').session;
  assert.equal(session.profile.objective, 'capture_leads');
  assert.equal(session.profile.audience, null);
  assert.match(getQualificationSummary(session), /Captar contatos/);
  assert.match(getQualificationSummary(session), /Público: Não informado/);
  assert.equal(session.profile.email, undefined);
  assert.equal(session.profile.phone, undefined);
});

test('R08-B questions during qualification are answered by R07 without losing the profile', () => {
  let session = choose(startOnepage(), 'r08:objective:present_company').session;
  const answer = send(session, 'O site inclui e-mail?');
  assert.equal(answer.session.profile.objective, 'present_company');
  assert.equal(answer.session.profile.audience, null);
  assert.match(answer.reply.text, /Não encontrei/);
  assert.match(answer.reply.text, /Quem você deseja alcançar/);
  assert.deepEqual(answer.reply.sources, []);
});

test('R08-B changing the confirmed service clears the old profile before asking again', () => {
  let session = choose(startOnepage(), 'r08:objective:present_company').session;
  const change = send(session, 'Na verdade prefiro Landing Page.');
  assert.equal(change.reply.intent, 'journey_confirmation_needed');
  assert.equal(change.session.phase, 'sales');
  assert.equal(change.session.profile, null);
  const confirmed = choose(change.session, 'confirm_goal');
  assert.equal(confirmed.session.profile.service, 'landing-page');
  assert.equal(confirmed.session.profile.objective, null);
});

test('R08-B handoff is generated only after explicit answers and is never sent', () => {
  const session = complete(startOnepage());
  assert.equal(session.phase, 'complete');
  assert.match(getQualificationSummary(session), /RESUMO DE ATENDIMENTO — RASCUNHO NÃO ENVIADO/);
  assert.match(getQualificationSummary(session), /Site Onepage/);
  assert.match(getQualificationSummary(session), /Apresentar a empresa/);
  assert.match(getQualificationSummary(session), /Sim, autorizou (nenhum contato foi enviado)/);
  assert.match(getQualificationSummary(session), /Nenhum dado de contato foi coletado/);
  assert.doesNotMatch(getQualificationSummary(session), /@|[0-9]{10,}/);
});

test('R08-B explicit correction clears dependent values and asks the corrected field again', () => {
  let session = complete(startOnepage());
  const correction = choose(session, 'r08:edit:audience');
  assert.equal(correction.session.profile.objective, 'present_company');
  assert.equal(correction.session.profile.audience, null);
  assert.equal(correction.session.profile.materials, null);
  assert.equal(correction.session.profile.timeline, null);
  assert.equal(correction.session.profile.contactConsent, 'not_asked');
  assert.match(correction.reply.text, /Quem você deseja alcançar/);
  session = choose(correction.session, 'r08:audience:businesses').session;
  session = choose(session, 'r08:materials:need_support').session;
  session = choose(session, 'r08:timeline:flexible').session;
  session = choose(session, 'r08:contactConsent:declined').session;
  assert.match(getQualificationSummary(session), /Outras empresas/);
  assert.match(getQualificationSummary(session), /Não concedida/);
  assert.doesNotMatch(getQualificationSummary(session), /Autorização declarada/);
});

test('R08-B summary action and copy model do not claim delivery', () => {
  const session = choose(startOnepage(), 'r08:objective:present_company').session;
  const summary = choose(session, 'r08:summary');
  assert.equal(summary.reply.intent, 'r08_qualification_question');
  assert.match(summary.reply.text, /RASCUNHO NÃO ENVIADO/);
  assert.match(getQualificationSummary(summary.session), /Nenhum contato foi coletado/);
});

test('R08-B viewing a partial handoff keeps the next question and its choices available', () => {
  const session = choose(startOnepage(), 'r08:objective:present_company').session;
  const summary = choose(session, 'r08:summary');
  assert.match(summary.reply.text, /RESUMO DE ATENDIMENTO/);
  assert.match(summary.reply.text, /Quem você deseja alcançar/);
  assert.ok(summary.reply.actions.some(item => item.id === 'r08:audience:businesses'));
  assert.equal(summary.session.profile.objective, 'present_company');
  assert.equal(summary.session.profile.audience, null);
});

test('R08-B separate conversations have independent profiles and confirmed services', () => {
  const a = startOnepage();
  const b0 = send(createQualificationJourney(), 'Preciso captar contatos para uma oferta.');
  const b = choose(b0.session, 'confirm_goal').session;
  const a1 = choose(a, 'r08:objective:present_company').session;
  assert.equal(a1.profile.service, 'onepage');
  assert.equal(b.profile.service, 'landing-page');
  assert.equal(b.profile.objective, null);
  assert.equal(a1.profile.objective, 'present_company');
});

test('R08-B rejects cloned sessions and never executes action getters', () => {
  const session = startOnepage();
  const cloned = respondQualificationJourney({ ...session }, { type: 'action', id: 'r08:objective:present_company' });
  assert.equal(cloned.reply.intent, 'r08_restart');
  let reads = 0;
  const hostile = { type: 'action', get id() { reads++; return 'r08:objective:present_company'; } };
  const refused = respondQualificationJourney(session, hostile);
  assert.equal(reads, 0);
  assert.equal(refused.reply.intent, 'r08_invalid_input');
});

test('R08-B service change and restart are explicit and discard the previous qualification', () => {
  const completeSession = complete(startOnepage());
  const changed = choose(completeSession, 'r08:change_service');
  assert.equal(changed.session.profile, null);
  assert.equal(changed.session.phase, 'sales');
  assert.deepEqual(changed.reply.actions.map(item => item.id), ['goal_presence', 'goal_campaign']);
  const restarted = choose(completeSession, 'r08:restart');
  assert.equal(restarted.session.profile, null);
  assert.equal(restarted.session.journey.coreSession.goal, null);
});

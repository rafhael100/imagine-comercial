import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLeadProfileFromJourney, validateLeadProfile, updateLeadProfile, reviseLeadProfile, getNextQualificationQuestion,
  isQualificationComplete, buildHandoffPackage, LEAD_PROFILE_SCHEMA, LEAD_HANDOFF_SCHEMA
} from '../ops/faisca/qualification/profile.mjs';
import { createJourney, respondJourney } from '../ops/faisca/journey/state.mjs';

function confirmedJourney(service) {
  const message = service === 'onepage' ? 'Quero apresentar minha empresa.' : 'Preciso captar contatos para uma oferta.';
  const proposal = respondJourney(createJourney(), { type: 'text', text: message });
  assert.equal(proposal.reply.intent, 'journey_confirmation_needed');
  const confirmed = respondJourney(proposal.session, { type: 'action', id: 'confirm_goal' });
  return confirmed.session;
}
function confirmedProfile(service = 'onepage') { return createLeadProfileFromJourney(confirmedJourney(service)); }

test('R08 profile can only begin from a service explicitly confirmed in a trusted R07 session', () => {
  const unconfirmed = createJourney();
  const proposed = respondJourney(unconfirmed, { type: 'text', text: 'Quero apresentar minha empresa.' });
  assert.equal(createLeadProfileFromJourney(unconfirmed), null);
  assert.equal(createLeadProfileFromJourney(proposed.session), null);
  assert.equal(confirmedProfile('onepage').service, 'onepage');
  assert.equal(confirmedProfile('landing-page').service, 'landing-page');
  const afterAnotherR07Choice = respondJourney(confirmedJourney('onepage'), { type: 'action', id: 'materials_ready' });
  assert.equal(createLeadProfileFromJourney(afterAnotherR07Choice.session).service, 'onepage');
  const previouslyConfirmed = confirmedJourney('onepage');
  const replacementPending = respondJourney(previouslyConfirmed, { type: 'text', text: 'Preciso captar contatos para uma oferta.' });
  assert.equal(createLeadProfileFromJourney(replacementPending.session), null,
    'a pending replacement service must be confirmed before qualification can start');
  assert.equal(createLeadProfileFromJourney({ ...confirmedJourney('onepage') }), null);
});

test('R08 initial profile has no inferred answers and asks one qualification question at a time', () => {
  const profile = confirmedProfile('onepage');
  assert.equal(profile.schema, LEAD_PROFILE_SCHEMA);
  assert.equal(profile.objective, null);
  assert.equal(profile.audience, null);
  assert.equal(profile.materials, null);
  assert.equal(profile.timeline, null);
  assert.equal(profile.contactConsent, 'not_asked');
  assert.equal(isQualificationComplete(profile), false);
  const next = getNextQualificationQuestion(profile);
  assert.equal(next.field, 'objective');
  assert.equal(next.options.length, 5);
});

test('R08 each explicit choice updates only its own field and advances one question', () => {
  const first = confirmedProfile('landing-page');
  const objective = updateLeadProfile(first, 'objective', 'capture_leads');
  assert.equal(objective.objective, 'capture_leads');
  assert.equal(objective.audience, null);
  assert.equal(first.objective, null, 'the previous immutable profile must not be mutated');
  assert.equal(getNextQualificationQuestion(objective).field, 'audience');
  const audience = updateLeadProfile(objective, 'audience', 'businesses');
  assert.equal(audience.audience, 'businesses');
  assert.equal(getNextQualificationQuestion(audience).field, 'materials');
});

test('R08 cannot set a future qualification field before the previous question is answered', () => {
  const profile = confirmedProfile('onepage');
  assert.equal(updateLeadProfile(profile, 'contactConsent', 'granted'), null);
  assert.equal(updateLeadProfile(profile, 'timeline', 'within_30_days'), null);
  assert.equal(getNextQualificationQuestion(profile).field, 'objective');
});

test('R08 visitor may explicitly skip a field without the system inventing an answer', () => {
  let profile = confirmedProfile('onepage');
  profile = updateLeadProfile(profile, 'objective', 'not_specified');
  profile = updateLeadProfile(profile, 'audience', 'not_specified');
  assert.equal(profile.objective, 'not_specified');
  assert.equal(profile.audience, 'not_specified');
  assert.equal(getNextQualificationQuestion(profile).field, 'materials');
  const handoff = buildHandoffPackage(profile);
  assert.match(handoff.summary, /Objetivo: Não informado/);
  assert.match(handoff.summary, /Público: Não informado/);
});

test('R08 only closed enum values are accepted; arbitrary text and unknown fields are refused', () => {
  const profile = confirmedProfile('onepage');
  assert.equal(updateLeadProfile(profile, 'objective', 'Quero vender muito'), null);
  assert.equal(updateLeadProfile(profile, 'email', 'visitor@example.invalid'), null);
  assert.equal(updateLeadProfile(profile, 'phone', '5511999999999'), null);
  assert.equal(updateLeadProfile(profile, 'objective', 'sell_online;crm.write'), null);
  assert.equal(updateLeadProfile(profile, 'timeline', 'tomorrow guaranteed'), null);
});

test('R08 contact consent is never inferred and is asked only after qualification fields', () => {
  let profile = confirmedProfile('landing-page');
  profile = updateLeadProfile(profile, 'objective', 'capture_leads');
  profile = updateLeadProfile(profile, 'audience', 'online_consumers');
  profile = updateLeadProfile(profile, 'materials', 'ready');
  profile = updateLeadProfile(profile, 'timeline', 'within_30_days');
  assert.equal(profile.contactConsent, 'not_asked');
  assert.equal(isQualificationComplete(profile), false);
  assert.equal(getNextQualificationQuestion(profile).field, 'contactConsent');
  profile = updateLeadProfile(profile, 'contactConsent', 'later');
  assert.equal(isQualificationComplete(profile), true);
  assert.match(buildHandoffPackage(profile).summary, /Prefere decidir depois/);
});

test('R08 consent options distinguish grant, refusal and deferment after the qualification sequence', () => {
  let profile = confirmedProfile('onepage');
  for (const [field, value] of [
    ['objective', 'not_specified'], ['audience', 'not_specified'],
    ['materials', 'not_specified'], ['timeline', 'not_specified']
  ]) profile = updateLeadProfile(profile, field, value);
  assert.equal(updateLeadProfile(profile, 'contactConsent', 'granted').contactConsent, 'granted');
  assert.equal(updateLeadProfile(profile, 'contactConsent', 'declined').contactConsent, 'declined');
  assert.equal(updateLeadProfile(profile, 'contactConsent', 'later').contactConsent, 'later');
  assert.equal(updateLeadProfile(profile, 'contactConsent', true), null);
});

test('R08 handoff is copy-only and never claims that the team received the lead', () => {
  let profile = confirmedProfile('onepage');
  profile = updateLeadProfile(profile, 'objective', 'present_company');
  profile = updateLeadProfile(profile, 'audience', 'local_customers');
  profile = updateLeadProfile(profile, 'materials', 'need_support');
  profile = updateLeadProfile(profile, 'timeline', 'flexible');
  profile = updateLeadProfile(profile, 'contactConsent', 'granted');
  const handoff = buildHandoffPackage(profile);
  assert.equal(handoff.schema, LEAD_HANDOFF_SCHEMA);
  assert.equal(handoff.delivery, 'copy_only');
  assert.equal(handoff.sent, false);
  assert.equal(handoff.operationalEffects, false);
  assert.match(handoff.summary, /RESUMO DE ATENDIMENTO — RASCUNHO NÃO ENVIADO/);
  assert.match(handoff.summary, /Sim, autorizou (nenhum contato foi enviado)/);
  assert.match(handoff.summary, /Nenhum dado de contato foi coletado/);
});

test('R08 strict profile validator rejects extra fields and accessors without executing them', () => {
  const profile = confirmedProfile('onepage');
  assert.equal(validateLeadProfile(profile).service, 'onepage');
  assert.equal(validateLeadProfile({ ...profile }), null, 'a caller cannot forge a server-created profile by cloning it');
  assert.equal(validateLeadProfile({ ...profile, email: 'visitor@example.invalid' }), null);
  assert.equal(updateLeadProfile({ ...profile }, 'objective', 'sell_online'), null);
  let reads = 0;
  const hostile = { ...profile };
  Object.defineProperty(hostile, 'objective', { enumerable: true, get() { reads++; return 'sell_online'; } });
  assert.equal(validateLeadProfile(hostile), null);
  assert.equal(reads, 0);
});

test('R08 updates are immutable and cannot change the confirmed service', () => {
  const profile = confirmedProfile('landing-page');
  const changed = updateLeadProfile(profile, 'objective', 'sell_online');
  assert.equal(updateLeadProfile(profile, 'service', 'onepage'), null, 'service is immutable after R07 confirmation');
  assert.equal(changed.service, 'landing-page');
  assert.equal(profile.service, 'landing-page');
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(changed), true);
});

test('R08 explicit correction clears only the selected field and dependent later answers', () => {
  let profile = confirmedProfile('onepage');
  for (const [field, value] of [
    ['objective', 'present_company'], ['audience', 'local_customers'],
    ['materials', 'ready'], ['timeline', 'within_30_days'],
    ['contactConsent', 'granted']
  ]) profile = updateLeadProfile(profile, field, value);
  const corrected = reviseLeadProfile(profile, 'audience');
  assert.equal(corrected.objective, 'present_company');
  assert.equal(corrected.audience, null);
  assert.equal(corrected.materials, null);
  assert.equal(corrected.timeline, null);
  assert.equal(corrected.contactConsent, 'not_asked');
  assert.equal(getNextQualificationQuestion(corrected).field, 'audience');
  assert.equal(profile.audience, 'local_customers', 'the previous profile remains immutable');
  assert.equal(reviseLeadProfile(profile, 'service'), null);
});

test('R08 summary contains only closed, explicitly supplied values and no scoring', () => {
  let profile = confirmedProfile('onepage');
  profile = updateLeadProfile(profile, 'objective', 'organize_service');
  const handoff = buildHandoffPackage(profile);
  assert.match(handoff.summary, /Objetivo: Organizar o atendimento/);
  assert.match(handoff.summary, /Público: Não informado/);
  assert.doesNotMatch(JSON.stringify(handoff), /score|probability|leadValue|email|phone/i);
});

test('R08 qualification can be completed with explicit choices and no personal contact data', () => {
  let profile = confirmedProfile('landing-page');
  for (const [field, value] of [
    ['objective', 'capture_leads'], ['audience', 'businesses'],
    ['materials', 'ready'], ['timeline', 'within_90_days'],
    ['contactConsent', 'declined']
  ]) profile = updateLeadProfile(profile, field, value);
  assert.equal(isQualificationComplete(profile), true);
  assert.equal(getNextQualificationQuestion(profile), null);
  const handoff = buildHandoffPackage(profile);
  assert.match(handoff.summary, /Landing Page/);
  assert.match(handoff.summary, /Captar contatos/);
  assert.match(handoff.summary, /Não concedida/);
});

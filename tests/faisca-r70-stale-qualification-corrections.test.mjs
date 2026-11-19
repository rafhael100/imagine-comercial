import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualificationJourney, respondQualificationJourney } from '../ops/faisca/qualification/journey.mjs';

const act = (session, id) => respondQualificationJourney(session, { type: 'action', id });
function started() {
  const proposed = act(createQualificationJourney(), 'goal_presence');
  const confirmed = act(proposed.session, 'confirm_goal');
  assert.equal(confirmed.session.phase, 'qualification');
  return confirmed.session;
}

test('R70 unanswered qualification fields reject stale edit actions without changing profile', () => {
  const initial = started();
  for (const field of ['objective', 'audience', 'materials', 'timeline', 'contactConsent']) {
    const refused = act(initial, 'r08:edit:' + field);
    assert.equal(refused.session.profile, initial.profile, field);
    assert.equal(refused.session.phase, 'qualification', field);
    assert.equal(refused.userText, '[Ação não aplicada]', field);
    assert.match(refused.reply.text, /correção não está disponível/, field);
    assert.match(refused.reply.text, /principal resultado/, field);
    assert.equal(refused.session.profile.contactConsent, 'not_asked', field);
    assert.ok(!JSON.stringify(refused).includes('checkoutUrl'), field);
  }
});

test('R70 correction of an already selected answer still clears downstream fields', () => {
  const initial = started();
  const objective = act(initial, 'r08:objective:present_company');
  assert.equal(objective.session.profile.objective, 'present_company');
  const correction = act(objective.session, 'r08:edit:objective');
  assert.equal(correction.session.profile.objective, null);
  assert.equal(correction.session.profile.contactConsent, 'not_asked');
  assert.equal(correction.userText, 'Corrigir objetivo');
  assert.match(correction.reply.text, /principal resultado/);
  assert.notEqual(correction.session.profile, objective.session.profile);
});

test('R70 after completion explicit consent correction remains functional and no Portal action is created', () => {
  let session = started();
  for (const id of [
    'r08:objective:present_company', 'r08:audience:businesses',
    'r08:materials:ready', 'r08:timeline:flexible', 'r08:contactConsent:declined'
  ]) session = act(session, id).session;
  assert.equal(session.phase, 'complete');
  const revised = act(session, 'r08:edit:contactConsent');
  assert.equal(revised.session.phase, 'qualification');
  assert.equal(revised.session.profile.contactConsent, 'not_asked');
  assert.equal(revised.session.profile.service, 'onepage');
  assert.match(revised.reply.text, /autoriza que a equipe Imagine entre em contato/);
  assert.notEqual(act(revised.session, 'r08:prepare_onepage').reply.intent, 'r58_portal_preparation_only');
});

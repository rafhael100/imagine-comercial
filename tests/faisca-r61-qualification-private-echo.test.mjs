import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualificationJourney, respondQualificationJourney } from '../ops/faisca/qualification/journey.mjs';

const act = (session, id) => respondQualificationJourney(session, { type: 'action', id });
const typed = (session, text) => respondQualificationJourney(session, { type: 'text', text });
function begin() {
  const proposed = act(createQualificationJourney(), 'goal_presence');
  const confirmed = act(proposed.session, 'confirm_goal');
  assert.equal(confirmed.session.phase, 'qualification');
  return confirmed.session;
}
function complete() {
  let session = begin();
  for (const id of [
    'r08:objective:present_company', 'r08:audience:businesses',
    'r08:materials:ready', 'r08:timeline:flexible',
    'r08:contactConsent:declined'
  ]) session = act(session, id).session;
  assert.equal(session.phase, 'complete');
  return session;
}

test('R61: unknown free text in qualification is not echoed or retained in UI response', () => {
  const before = begin();
  const marker = 'MARCADOR_SINTETICO_PRIVADO_R61_ALFA';
  const turn = typed(before, marker);
  assert.equal(turn.userText, '[Mensagem livre não registrada]');
  assert.equal(turn.session.profile.objective, null);
  assert.equal(turn.session.phase, 'qualification');
  assert.match(turn.reply.text, /Qual é o principal resultado/);
  assert.ok(!JSON.stringify(turn).includes(marker));
  assert.deepEqual(turn.reply.sources, []);
});

test('R61: a free-text service switch still requires confirmation but does not echo raw prose', () => {
  const before = begin();
  const marker = 'MARCADOR_SINTETICO_PRIVADO_R61_BETA';
  const proposed = typed(before, 'Quero Landing Page. ' + marker);
  assert.equal(proposed.session.phase, 'service_change_pending');
  assert.equal(proposed.session.profile.service, 'onepage');
  assert.equal(proposed.session.journey.pendingGoal, 'goal_campaign');
  assert.equal(proposed.userText, '[Mensagem livre não registrada]');
  assert.ok(!JSON.stringify(proposed).includes(marker));
  const rejected = act(proposed.session, 'cancel_goal');
  assert.equal(rejected.session.journey.pendingGoal, null);
  assert.equal(rejected.session.profile.service, 'onepage');
});

test('R61: complete Onepage qualification discards unmatched visitor prose without disabling preview', () => {
  const before = complete();
  const marker = 'MARCADOR_SINTETICO_PRIVADO_R61_GAMA';
  const turn = typed(before, marker);
  assert.equal(turn.userText, '[Mensagem livre não registrada]');
  assert.equal(turn.session.phase, 'complete');
  assert.equal(turn.session.profile.contactConsent, 'declined');
  assert.ok(!JSON.stringify(turn).includes(marker));
  const preview = act(turn.session, 'r08:prepare_onepage');
  assert.equal(preview.reply.intent, 'r58_portal_preparation_only');
  assert.doesNotMatch(preview.reply.text, /https?:\/\/|R\$\s*\d/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQualificationJourney, respondQualificationJourney
} from '../ops/faisca/qualification/journey.mjs';

const type = (session, text) => respondQualificationJourney(session, { type: 'text', text });
const act = (session, id) => respondQualificationJourney(session, { type: 'action', id });
const REDACTED = '[Mensagem livre não registrada]';

test('R67 sales: unmatched private text is not reflected in the anonymous transcript', () => {
  const marker = 'MARCADOR_PRIVADO_SINTETICO_R67_A';
  const turn = type(createQualificationJourney(), marker);
  assert.equal(turn.session.phase, 'sales');
  assert.equal(turn.userText, REDACTED);
  assert.equal(turn.session.profile, null);
  assert.deepEqual(turn.reply.sources, []);
  assert.ok(!JSON.stringify(turn).includes(marker));
});

test('R67 sales: a recognizable Onepage request stays actionable without echoing extra text', () => {
  const marker = 'MARCADOR_PRIVADO_SINTETICO_R67_B';
  const proposed = type(createQualificationJourney(), 'Quero avaliar Site Onepage. ' + marker);
  assert.equal(proposed.session.phase, 'sales');
  assert.equal(proposed.session.journey.pendingGoal, 'goal_presence');
  assert.equal(proposed.userText, REDACTED);
  assert.ok(!JSON.stringify(proposed).includes(marker));
  assert.equal(proposed.reply.intent, 'journey_confirmation_needed');
  const confirmed = act(proposed.session, 'confirm_goal');
  assert.equal(confirmed.session.phase, 'qualification');
  assert.equal(confirmed.session.profile.service, 'onepage');
  assert.ok(!JSON.stringify(confirmed).includes(marker));
});

test('R67 sales: grounded FAQ or handoff guidance never returns arbitrary typed bytes', () => {
  const marker = 'MARCADOR_PRIVADO_SINTETICO_R67_C';
  const result = type(createQualificationJourney(), 'Quero falar com alguem. ' + marker);
  assert.equal(result.userText, REDACTED);
  assert.ok(!JSON.stringify(result).includes(marker));
  assert.equal(result.session.profile, null);
});

test('R67 sales: closed-choice action labels are unchanged for the accessible buttons', () => {
  const first = act(createQualificationJourney(), 'goal_presence');
  assert.notEqual(first.userText, REDACTED);
  assert.equal(first.userText, 'Apresentar minha empresa');
  const confirmed = act(first.session, 'confirm_goal');
  assert.equal(confirmed.session.phase, 'qualification');
});

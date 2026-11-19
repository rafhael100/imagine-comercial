import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualificationJourney, respondQualificationJourney } from '../ops/faisca/qualification/journey.mjs';
import { isQualificationComplete } from '../ops/faisca/qualification/profile.mjs';

const act = id => ({ type: 'action', id });
const choose = (session, id) => respondQualificationJourney(session, act(id));

function complete(service, consent) {
  let turn = choose(createQualificationJourney(), service);
  turn = choose(turn.session, 'confirm_goal');
  for (const id of [
    'r08:objective:present_company', 'r08:audience:businesses',
    'r08:materials:ready', 'r08:timeline:flexible',
    'r08:contactConsent:' + consent
  ]) turn = choose(turn.session, id);
  assert.equal(turn.session.phase, 'complete');
  return turn.session;
}

function seeds() {
  const onepage = complete('goal_presence', 'granted');
  const declined = complete('goal_presence', 'declined');
  const landing = complete('goal_campaign', 'later');
  const pendingOnepage = choose(choose(onepage, 'r08:change_service').session, 'goal_campaign').session;
  const pendingLanding = choose(choose(landing, 'r08:change_service').session, 'goal_presence').session;
  const partial = choose(choose(createQualificationJourney(), 'goal_presence').session, 'confirm_goal').session;
  return [onepage, declined, landing, pendingOnepage, pendingLanding, partial, createQualificationJourney()];
}

const actions = Object.freeze([
  'r08:change_service', 'r08:keep_service', 'r08:prepare_onepage',
  'r08:next_steps', 'r08:summary', 'r08:restart',
  'r08:edit:objective', 'r08:edit:audience', 'r08:edit:materials',
  'r08:edit:timeline', 'r08:edit:contactConsent',
  'goal_presence', 'goal_campaign', 'confirm_goal', 'cancel_goal',
  'r08:objective:present_company', 'r08:audience:businesses',
  'r08:materials:ready', 'r08:timeline:flexible',
  'r08:contactConsent:granted', 'r08:contactConsent:declined'
]);

function invariant(turn, trace) {
  assert.equal(turn.session.journey.pendingGoal === null ||
    typeof turn.session.journey.pendingGoal === 'string', true, trace);
  assert.equal(Object.isFrozen(turn.session), true, trace);
  assert.equal(Array.isArray(turn.reply.actions), true, trace);
  assert.equal(Object.isFrozen(turn.reply.actions), true, trace);
  assert.equal(new Set(turn.reply.actions.map(a => a.id)).size, turn.reply.actions.length, trace);
  // These local R08/R58 replies are also serialized through a six-action
  // closed contract when used by the HTTP laboratory.
  if (/^r08_|^r58_/.test(turn.reply.intent)) {
    assert.ok(turn.reply.actions.length <= 6, trace + ': HTTP action limit exceeded');
  }
  if (turn.reply.intent === 'r08_next_steps') {
    assert.equal(turn.session.phase, 'complete', trace);
    assert.equal(turn.session.journey.pendingGoal, null, trace);
    assert.equal(isQualificationComplete(turn.session.profile), true, trace);
  }
  if (turn.reply.intent === 'r58_portal_preparation_only') {
    assert.equal(turn.session.phase, 'complete', trace);
    assert.equal(turn.session.journey.pendingGoal, null, trace);
    assert.equal(turn.session.profile.service, 'onepage', trace);
    assert.equal(isQualificationComplete(turn.session.profile), true, trace);
    assert.deepEqual(turn.reply.sources, [], trace);
    assert.match(turn.reply.text, /aceite explícito/, trace);
    assert.match(turn.reply.text, /não criou conta, cotação, pedido, cobrança/, trace);
    assert.doesNotMatch(turn.reply.text, /https?:\/\/|R\$\s*\d|checkout\//i, trace);
  }
  if (turn.session.journey.pendingGoal !== null) {
    assert.notEqual(turn.reply.intent, 'r58_portal_preparation_only', trace);
    assert.notEqual(turn.reply.intent, 'r08_next_steps', trace);
  }
}

test('R60: bounded adversarial two-step state exploration preserves explicit Onepage preparation gates', () => {
  const initial = seeds();
  let inspected = 0;
  for (let seedIndex = 0; seedIndex < initial.length; seedIndex++) {
    for (const first of actions) {
      const firstTurn = choose(initial[seedIndex], first);
      invariant(firstTurn, 'seed=' + seedIndex + ', first=' + first);
      inspected++;
      for (const second of actions) {
        const secondTurn = choose(firstTurn.session, second);
        invariant(secondTurn, 'seed=' + seedIndex + ', first=' + first + ', second=' + second);
        inspected++;
      }
    }
  }
  assert.ok(inspected >= 3000, 'The state matrix must actually execute the adversarial combinations.');
});

test('R60: no stale Portal preview after restarts or a new service confirmation', () => {
  const completed = complete('goal_presence', 'granted');
  const pending = choose(choose(completed, 'r08:change_service').session, 'goal_campaign');
  const changed = choose(pending.session, 'confirm_goal');
  assert.equal(changed.session.profile.service, 'landing-page');
  assert.notEqual(choose(changed.session, 'r08:prepare_onepage').reply.intent, 'r58_portal_preparation_only');
  const reset = choose(changed.session, 'r08:restart');
  assert.equal(reset.session.profile, null);
  assert.equal(reset.session.journey.pendingGoal, null);
  assert.notEqual(choose(reset.session, 'r08:prepare_onepage').reply.intent, 'r58_portal_preparation_only');
});

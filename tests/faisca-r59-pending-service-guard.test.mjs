import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualificationJourney, respondQualificationJourney } from '../ops/faisca/qualification/journey.mjs';
import { createQualificationPrepareTurn } from '../ops/faisca/qualification/http-runtime.mjs';

const input = id => ({ type: 'action', id });
const choose = (session, id) => respondQualificationJourney(session, input(id));

function complete(service = 'goal_presence', consent = 'declined') {
  let turn = choose(createQualificationJourney(), service);
  turn = choose(turn.session, 'confirm_goal');
  for (const id of [
    'r08:objective:present_company',
    'r08:audience:businesses',
    'r08:materials:ready',
    'r08:timeline:flexible',
    'r08:contactConsent:' + consent
  ]) turn = choose(turn.session, id);
  assert.equal(turn.session.phase, 'complete');
  return turn.session;
}

test('R59: reopening service selection during a pending confirmation must not restore a stale Onepage preview', () => {
  for (const consent of ['granted', 'declined', 'later']) {
    const completed = complete('goal_presence', consent);
    const reselect = choose(completed, 'r08:change_service');
    const pending = choose(reselect.session, 'goal_campaign');
    assert.equal(pending.session.phase, 'service_change_pending');
    assert.equal(pending.session.journey.pendingGoal, 'goal_campaign');

    // Before R59, this unadvertised action opened service_reselect and
    // r08:keep_service restored phase=complete while pendingGoal stayed set.
    const repeated = choose(pending.session, 'r08:change_service');
    assert.equal(repeated.session, pending.session);
    assert.equal(repeated.session.phase, 'service_change_pending');
    assert.equal(repeated.reply.intent, 'r08_service_change_pending');
    assert.deepEqual(repeated.reply.actions.map(item => item.id), ['confirm_goal', 'cancel_goal']);
    assert.equal(repeated.session.profile.contactConsent, consent);

    const forgedKeep = choose(repeated.session, 'r08:keep_service');
    assert.equal(forgedKeep.session.phase, 'service_change_pending');
    assert.ok(!forgedKeep.reply.actions.some(item => item.id === 'r08:prepare_onepage'));

    for (const id of ['r08:next_steps', 'r08:prepare_onepage']) {
      const blocked = choose(repeated.session, id);
      assert.equal(blocked.session.phase, 'service_change_pending');
      assert.notEqual(blocked.reply.intent, 'r58_portal_preparation_only');
      assert.doesNotMatch(blocked.reply.text, /cotação calculada pelo Portal/i);
    }

    const cancelled = choose(pending.session, 'cancel_goal');
    assert.equal(cancelled.session.phase, 'complete');
    assert.equal(cancelled.session.journey.pendingGoal, null);
    assert.equal(cancelled.session.profile.service, 'onepage');
    const preview = choose(cancelled.session, 'r08:prepare_onepage');
    assert.equal(preview.reply.intent, 'r58_portal_preparation_only');
    assert.equal(preview.session.profile.contactConsent, consent);
    assert.equal(preview.session.journey.pendingGoal, null);
    assert.deepEqual(preview.reply.sources, []);
  }
});

test('R59: confirmation, not repeated reselect, is required to change a qualified service', () => {
  const onepage = complete();
  const changing = choose(onepage, 'r08:change_service');
  const pending = choose(changing.session, 'goal_campaign');
  const blocked = choose(pending.session, 'r08:change_service');
  const confirmed = choose(blocked.session, 'confirm_goal');
  assert.equal(confirmed.session.profile.service, 'landing-page');
  assert.equal(confirmed.session.journey.pendingGoal, null);
  const preview = choose(confirmed.session, 'r08:prepare_onepage');
  assert.equal(preview.reply.intent, 'r58_portal_preparation_unavailable');
  assert.equal(confirmed.session.profile.contactConsent, 'not_asked');
  assert.equal(confirmed.session.phase, 'qualification');
});

test('R59: local HTTP prepare-turn closure cannot bypass a pending switch or produce operational effects', () => {
  const prepareTurn = createQualificationPrepareTurn('a'.repeat(32));
  let flow = prepareTurn(null, input('goal_presence'));
  flow = prepareTurn(null, input('confirm_goal'));
  for (const id of [
    'r08:objective:present_company', 'r08:audience:businesses',
    'r08:materials:ready', 'r08:timeline:flexible',
    'r08:contactConsent:declined'
  ]) flow = prepareTurn(null, input(id));
  assert.equal(flow.session.phase, 'complete');
  flow = prepareTurn(null, input('r08:change_service'));
  flow = prepareTurn(null, input('goal_campaign'));
  for (const id of ['r08:change_service', 'r08:keep_service', 'r08:next_steps', 'r08:prepare_onepage']) {
    flow = prepareTurn(null, input(id));
    assert.equal(flow.session.phase, 'service_change_pending');
    assert.equal(flow.session.journey.pendingGoal, 'goal_campaign');
    assert.notEqual(flow.reply.intent, 'r58_portal_preparation_only');
    assert.equal(flow.providerReply, undefined);
  }
  const sensitive = 'minha senha de acesso eh 123456789!';
  flow = prepareTurn(null, { type: 'text', text: sensitive });
  assert.equal(flow.userText, '[Mensagem livre não registrada]');
  assert.ok(!JSON.stringify(flow.reply).includes(sensitive));
  assert.equal(flow.session.phase, 'service_change_pending');
  flow = prepareTurn(null, input('cancel_goal'));
  assert.equal(flow.session.journey.pendingGoal, null);
  flow = prepareTurn(null, input('r08:prepare_onepage'));
  assert.equal(flow.reply.intent, 'r58_portal_preparation_only');
  assert.equal(flow.reply.actions.every(item => !/pay|checkout|crm|write/.test(item.id)), true);
});

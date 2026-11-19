import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQualificationJourney, respondQualificationJourney, getQualificationSummary
} from '../ops/faisca/qualification/journey.mjs';

const choose = (session, id) => respondQualificationJourney(session, { type: 'action', id });

function begin() {
  const pending = choose(createQualificationJourney(), 'goal_presence');
  const confirmed = choose(pending.session, 'confirm_goal');
  assert.equal(confirmed.reply.intent, 'r08_qualification_question');
  return confirmed.session;
}

test('R58: oversized, invisible or non-ASCII action ids fail closed before qualification dispatch', () => {
  const session = begin();
  const bad = [
    'r08:objective:capture_leads' + 'x'.repeat(100000),
    'r08:objective:capture_leads\n',
    'r08:objective:capture_leads\u200b',
    'r08:objective:capture_leads\u0000',
    'r08:objective:capture_leads ',
    'r08:objective:capture_leads🔥',
    '',
    'R08:objective:capture_leads'
  ];
  for (const id of bad) {
    const result = choose(session, id);
    assert.equal(result.reply.intent, 'r08_invalid_input');
    assert.equal(result.userText, '');
    assert.equal(result.session, session);
    assert.equal(result.session.profile.objective, null);
    assert.deepEqual(result.reply.sources, []);
    assert.doesNotMatch(result.reply.text + getQualificationSummary(result.session),
      /100000|capture_leads|EXEMPLO-SINTETICO|\u200b/);
  }
});

test('R58: valid action IDs still advance both services and legitimate qualification choices', () => {
  for (const [service, expected] of [['goal_presence', 'onepage'], ['goal_campaign', 'landing-page']]) {
    const pending = choose(createQualificationJourney(), service);
    const confirmed = choose(pending.session, 'confirm_goal');
    const selected = choose(confirmed.session, 'r08:objective:capture_leads');
    assert.equal(selected.session.profile.service, expected);
    assert.equal(selected.session.profile.objective, 'capture_leads');
    assert.equal(selected.reply.intent, 'r08_qualification_question');
    assert.deepEqual(selected.reply.sources, []);
  }
});

test('R58: malformed action envelope cannot mutate a granted contact-consent selection', () => {
  let session = begin();
  for (const id of ['r08:objective:present_company', 'r08:audience:businesses',
    'r08:materials:ready', 'r08:timeline:flexible', 'r08:contactConsent:granted']) {
    session = choose(session, id).session;
  }
  assert.equal(session.profile.contactConsent, 'granted');
  const before = getQualificationSummary(session);
  const result = choose(session, 'r08:edit:contactConsent' + 'z'.repeat(100));
  assert.equal(result.session, session);
  assert.equal(result.session.profile.contactConsent, 'granted');
  assert.equal(getQualificationSummary(result.session), before);
  assert.equal(result.userText, '');
});

test('R58: action getter is never invoked, while a valid plain ASCII id remains accepted', () => {
  const start = begin();
  let reads = 0;
  const accessor = { type: 'action', get id() { reads++; return 'r08:objective:present_company'; } };
  const invalid = respondQualificationJourney(start, accessor);
  assert.equal(reads, 0);
  assert.equal(invalid.session, start);
  assert.equal(invalid.reply.intent, 'r08_invalid_input');
  const selected = choose(start, 'r08:objective:present_company');
  assert.equal(selected.session.profile.objective, 'present_company');
});

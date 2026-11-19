import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualificationJourney, respondQualificationJourney } from '../ops/faisca/qualification/journey.mjs';
import { reviewQualificationServiceFit, SERVICE_FIT_SCHEMA } from '../ops/faisca/qualification/service-fit.mjs';
import { buildQualificationNextStep } from '../ops/faisca/qualification/next-step.mjs';
const choose = (session, id) => respondQualificationJourney(session, { type: 'action', id });

function qualified(service, objective, consent = 'declined') {
  let flow = choose(createQualificationJourney(), service);
  flow = choose(flow.session, 'confirm_goal');
  for (const id of [
    'r08:objective:' + objective, 'r08:audience:businesses',
    'r08:materials:ready', 'r08:timeline:within_30_days',
    'r08:contactConsent:' + consent
  ]) flow = choose(flow.session, id);
  assert.equal(flow.session.phase, 'complete');
  return flow.session;
}

test('R19 prompts review for the two conservative mismatches without changing selected service', () => {
  const cases = [
    ['goal_presence', 'capture_leads', 'onepage', 'landing-page', /captar contatos/],
    ['goal_campaign', 'present_company', 'landing-page', 'onepage', /apresentar a empresa/]
  ];
  for (const [service, objective, expectedService, alternative, phrase] of cases) {
    const session = qualified(service, objective);
    const decision = reviewQualificationServiceFit(session.profile);
    assert.equal(decision.schema, SERVICE_FIT_SCHEMA);
    assert.equal(decision.selectedService, expectedService);
    assert.equal(decision.status, 'consider_alternative');
    assert.equal(decision.alternativeService, alternative);
    assert.match(decision.text, phrase);
    assert.match(decision.text, /Sua escolha atual foi mantida/);
    assert.equal(decision.reviewOnly, true);
    assert.equal(decision.selectionChanged, false);
    assert.equal(decision.orderCreated, false);
    assert.equal(decision.contactCollected, false);
    assert.equal(decision.operationalEffects, false);
    assert.equal(Object.isFrozen(decision), true);

    const next = choose(session, 'r08:next_steps');
    assert.equal(next.reply.intent, 'r08_next_steps');
    assert.equal(next.session, session);
    assert.ok(next.reply.text.includes(decision.text));
    assert.ok(next.reply.actions.some(action => action.id === 'r08:change_service'));
    assert.equal(next.session.profile.service, expectedService);
    assert.equal(buildQualificationNextStep(session.profile).serviceFitReviewCode, 'consider_alternative');
  }
});

test('R19 matched, undecided and unsupported objectives receive no invented confidence claim', () => {
  for (const [service, objective] of [
    ['goal_presence', 'present_company'], ['goal_campaign', 'capture_leads'],
    ['goal_presence', 'not_specified'], ['goal_campaign', 'sell_online'],
    ['goal_presence', 'organize_service']
  ]) {
    const session = qualified(service, objective);
    const fit = reviewQualificationServiceFit(session.profile);
    assert.equal(fit.status, 'no_heuristic_conflict');
    assert.equal(fit.alternativeService, null);
    assert.equal(fit.text, '');
    assert.equal(buildQualificationNextStep(session.profile).serviceFitReviewCode, 'no_heuristic_conflict');
    assert.doesNotMatch(choose(session, 'r08:next_steps').reply.text, /Vale comparar também com/);
  }
});

test('R19 no profile, incomplete profile, clone or hostile getter can claim a fit result', () => {
  assert.equal(reviewQualificationServiceFit(null), null);
  const pending = choose(createQualificationJourney(), 'goal_presence');
  assert.equal(reviewQualificationServiceFit(pending.session.profile), null);
  const selected = choose(pending.session, 'confirm_goal');
  assert.equal(reviewQualificationServiceFit(selected.session.profile), null);
  const complete = qualified('goal_presence', 'capture_leads');
  assert.equal(reviewQualificationServiceFit({ ...complete.profile }), null);
  let reads = 0;
  const object = {};
  Object.defineProperty(object, 'service', { enumerable: true, get() {
    reads++; return 'onepage';
  } });
  assert.equal(reviewQualificationServiceFit(object), null);
  assert.equal(reads, 0);
});

test('R19 review does not bypass explicit confirmation or contact choice', () => {
  for (const contact of ['granted', 'declined', 'later']) {
    const session = qualified('goal_presence', 'capture_leads', contact);
    const next = choose(session, 'r08:next_steps');
    assert.equal(next.session.profile.contactConsent, contact);
    assert.equal(next.session.profile.service, 'onepage');
    const change = choose(next.session, 'r08:change_service');
    assert.equal(change.session.phase, 'service_reselect');
    assert.equal(change.session.profile, session.profile);
    const keep = choose(change.session, 'r08:keep_service');
    assert.equal(keep.session.profile.service, 'onepage');
    assert.equal(keep.session.profile.contactConsent, contact);
    const guide = buildQualificationNextStep(session.profile);
    assert.equal(guide.portalPublicCheckoutAuthorized, false);
    assert.equal(guide.sent, false);
    assert.equal(guide.contactCollected, false);
  }
});

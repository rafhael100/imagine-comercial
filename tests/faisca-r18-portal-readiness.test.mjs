import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualificationJourney, respondQualificationJourney } from '../ops/faisca/qualification/journey.mjs';
import { buildFaiscaPortalReadiness, FAISCA_PORTAL_READINESS_SCHEMA } from '../ops/faisca/qualification/portal-readiness.mjs';
import { buildQualificationNextStep } from '../ops/faisca/qualification/next-step.mjs';
import {
  assessPublicPortalReadiness, describePublicPortalReadiness
} from '../src/lib/public-portal-checkout-readiness.mjs';

const choose = (session, id) => respondQualificationJourney(session, { type: 'action', id });
function qualified(serviceId, consent = 'declined') {
  let turn = choose(createQualificationJourney(), serviceId);
  assert.equal(turn.reply.intent, 'journey_confirmation_needed');
  turn = choose(turn.session, 'confirm_goal');
  assert.equal(turn.reply.intent, 'r08_qualification_question');
  for (const id of [
    'r08:objective:present_company', 'r08:audience:businesses',
    'r08:materials:ready', 'r08:timeline:within_30_days',
    'r08:contactConsent:' + consent
  ]) turn = choose(turn.session, id);
  assert.equal(turn.session.phase, 'complete');
  return turn.session;
}

test('R18 Onepage and Landing Page adopt the exact existing Commercial F348 checkout boundary', () => {
  const pairs = [['goal_presence', 'onepage', 'onepage'], ['goal_campaign', 'landing-page', 'landing-pages']];
  for (const [action, service, site] of pairs) {
    const session = qualified(action);
    const actual = buildFaiscaPortalReadiness(session.profile);
    const selected = { site, channels: [], tier: 'minimum' };
    const commercial = assessPublicPortalReadiness(selected);
    assert.equal(actual.schema, FAISCA_PORTAL_READINESS_SCHEMA);
    assert.equal(actual.service, service);
    assert.equal(actual.source, 'imagine-comercial-f348');
    assert.equal(actual.readinessCode, commercial.code);
    assert.equal(actual.readinessCode, 'private_single_preview_only');
    assert.equal(actual.text, describePublicPortalReadiness(selected, 'pt-BR'));
    assert.equal(actual.privatePreviewOnly, true);
    assert.equal(actual.publicCheckoutAuthorized, false);
    assert.equal(actual.portalLoginOrRedirectAuthorized, false);
    assert.equal(actual.orderCreated, false);
    assert.equal(actual.paymentCreated, false);
    assert.equal(actual.credentialsRequested, false);
    assert.equal(actual.finalServerRepricingRequired, true);
    assert.equal(actual.operationalEffects, false);
    assert.equal(Object.isFrozen(actual), true);
  }
});

test('R18 the copy-only next step cites current availability, never price or a live checkout URL', () => {
  for (const service of ['goal_presence', 'goal_campaign']) {
    const session = qualified(service, 'later');
    const guide = buildQualificationNextStep(session.profile);
    const readiness = buildFaiscaPortalReadiness(session.profile);
    assert.equal(guide.portalReadinessCode, readiness.readinessCode);
    assert.equal(guide.portalPublicCheckoutAuthorized, false);
    assert.ok(guide.text.includes(readiness.text));
    assert.match(guide.text, /contratação pública ainda não está disponível/i);
    assert.match(guide.text, /Portal Imagine/);
    assert.equal(guide.sent, false);
    assert.equal(guide.paymentCreated, false);
    assert.equal(guide.operationalEffects, false);
    assert.doesNotMatch(guide.text, /https?:\/\/|R\$\s?\d|[0-9]{3,}[.,][0-9]{2}/);
    assert.doesNotMatch(JSON.stringify(guide), /"tenant"|"email"|"phone"|"checkoutUrl"|"paymentToken"/);
  }
});

test('R18 unauthorized profiles and incomplete qualifications never produce a Portal readiness statement', () => {
  assert.equal(buildFaiscaPortalReadiness(null), null);
  assert.equal(buildFaiscaPortalReadiness({ service: 'onepage' }), null);
  const proposed = choose(createQualificationJourney(), 'goal_presence');
  assert.equal(proposed.session.profile, null);
  assert.equal(buildFaiscaPortalReadiness(proposed.session.profile), null);
  const partial = choose(proposed.session, 'confirm_goal');
  assert.equal(buildFaiscaPortalReadiness(partial.session.profile), null);
  assert.equal(buildFaiscaPortalReadiness({ ...qualified('goal_presence').profile }), null);

  let getters = 0;
  const forged = {};
  Object.defineProperty(forged, 'service', { enumerable: true, get() {
    getters++;
    throw new Error('No getter may execute');
  } });
  assert.equal(buildFaiscaPortalReadiness(forged), null);
  assert.equal(getters, 0);
});

test('R18 declining contact does not block help or authorize contact, login, cart or payment', () => {
  for (const consent of ['granted', 'declined', 'later']) {
    const session = qualified('goal_presence', consent);
    const result = buildFaiscaPortalReadiness(session.profile);
    const guide = buildQualificationNextStep(session.profile);
    assert.equal(result.publicCheckoutAuthorized, false);
    assert.equal(result.portalLoginOrRedirectAuthorized, false);
    assert.equal(result.orderCreated, false);
    assert.equal(result.paymentCreated, false);
    assert.equal(guide.contactCollected, false);
    assert.equal(guide.sent, false);
    assert.equal(guide.portalPublicCheckoutAuthorized, false);
    assert.ok(guide.text.length > 100);
  }
});

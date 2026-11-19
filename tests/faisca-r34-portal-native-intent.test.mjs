import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualificationJourney, respondQualificationJourney } from '../ops/faisca/qualification/journey.mjs';
import { buildNativeOnepagePortalIntent, NATIVE_ONEPAGE_INTENT_SCHEMA,
  NATIVE_ONEPAGE_PORTAL_PIN } from '../ops/faisca/qualification/portal-native-intent.mjs';
import { buildQualificationNextStep } from '../ops/faisca/qualification/next-step.mjs';
import { buildFaiscaPortalReadiness } from '../ops/faisca/qualification/portal-readiness.mjs';

const choose = (session, id) => respondQualificationJourney(session, { type: 'action', id });
function qualified(service, consent) {
  let t = choose(createQualificationJourney(), service);
  t = choose(t.session, 'confirm_goal');
  for (const id of [
    'r08:objective:present_company', 'r08:audience:businesses',
    'r08:materials:ready', 'r08:timeline:within_30_days',
    'r08:contactConsent:' + consent
  ]) t = choose(t.session, id);
  assert.equal(t.session.phase, 'complete');
  return t.session;
}

test('R34 only a trusted completed Onepage selection yields a non-operational intent', () => {
  const session = qualified('goal_presence', 'declined');
  const result = buildNativeOnepagePortalIntent(session.profile);
  assert.equal(result.schema, NATIVE_ONEPAGE_INTENT_SCHEMA);
  assert.equal(result.portalContractPin, NATIVE_ONEPAGE_PORTAL_PIN);
  assert.equal(result.status, 'onepage_intent_only');
  assert.equal(result.service, 'onepage');
  assert.deepEqual(result.offerHint, { site: 'onepage' });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.offerHint), true);
  for (const key of [
    'needsAuthenticatedPortalSession', 'needsPortalTierChoice',
    'needsPortalQuoteAndTermsReview', 'needsExplicitBuyerAcceptance'
  ]) assert.equal(result[key], true, key);
  for (const key of [
    'publicCheckoutAuthorized', 'portalLoginOrRedirectAuthorized', 'requestCreated',
    'leadSent', 'orderCreated', 'paymentRequested', 'productionStarted',
    'operationalEffects'
  ]) assert.equal(result[key], false, key);
  assert.equal(Object.keys(result.offerHint).length, 1,
    'No contract tier, channels, price, tenant, buyer or identity may be selected in Faísca');
  assert.equal(result.offerHint.tier, undefined);
  assert.equal(result.offerHint.channels, undefined);
  assert.equal(result.offerHint.request_key, undefined);
  assert.equal(result.offerHint.selection, undefined);
  assert.equal(buildFaiscaPortalReadiness(session.profile).publicCheckoutAuthorized, false);
  assert.equal(buildQualificationNextStep(session.profile).delivery, 'copy_only');
});

test('R34 Landing Page does not silently pass as a native Onepage order', () => {
  const session = qualified('goal_campaign', 'granted');
  const intent = buildNativeOnepagePortalIntent(session.profile);
  assert.equal(intent.status, 'native_onepage_not_supported');
  assert.equal(intent.service, 'landing-page');
  assert.equal(intent.offerHint, null);
  assert.equal(intent.needsPortalTierChoice, false);
  assert.equal(intent.needsPortalQuoteAndTermsReview, false);
  assert.equal(intent.needsExplicitBuyerAcceptance, false);
  assert.equal(intent.orderCreated, false);
  assert.equal(intent.leadSent, false);
  assert.equal(intent.operationalEffects, false);
  assert.equal(Object.isFrozen(intent), true);
});

test('R34 no contact preference authorizes identity, order or request dispatch', () => {
  for (const consent of ['declined', 'granted', 'later']) {
    const session = qualified('goal_presence', consent);
    const intent = buildNativeOnepagePortalIntent(session.profile);
    assert.equal(intent.orderCreated, false);
    assert.equal(intent.leadSent, false);
    assert.equal(intent.portalLoginOrRedirectAuthorized, false);
    assert.equal(intent.publicCheckoutAuthorized, false);
    assert.equal(intent.offerHint.site, 'onepage');
    assert.equal(intent.needsExplicitBuyerAcceptance, true);
    const json = JSON.stringify(intent);
    for (const forbidden of [
      '"contactConsent"', '"tenant"', '"tenantId"', '"buyer"', '"email"', '"phone"',
      '"request_key"', '"payment"', '"price"', '"tier"', '"channels"', '"contractText"'
    ]) assert.equal(json.includes(forbidden), false, forbidden);
    assert.doesNotMatch(json, /https?:\/\//);
  }
});

test('R34 incomplete, unconfirmed or forged profile cannot create a Portal intent', () => {
  assert.equal(buildNativeOnepagePortalIntent(null), null);
  const preselection = choose(createQualificationJourney(), 'goal_presence');
  assert.equal(buildNativeOnepagePortalIntent(preselection.session.profile), null);
  const partial = choose(preselection.session, 'confirm_goal');
  assert.equal(buildNativeOnepagePortalIntent(partial.session.profile), null);
  const completed = qualified('goal_presence', 'granted');
  assert.equal(buildNativeOnepagePortalIntent({ ...completed.profile }), null);
  let reads = 0;
  const hostile = {};
  Object.defineProperty(hostile, 'service', {
    enumerable: true, get() { reads++; return 'onepage'; }
  });
  assert.equal(buildNativeOnepagePortalIntent(hostile), null);
  assert.equal(reads, 0);
});

test('R34 intent never changes when a private request is issued during service switch', () => {
  const completed = qualified('goal_presence', 'declined');
  const change = choose(completed, 'r08:change_service');
  const pending = choose(change.session, 'goal_campaign');
  assert.equal(pending.session.phase, 'service_change_pending');
  const sanitized = respondQualificationJourney(pending.session, {
    type: 'text', text: 'Meu token de acesso ABC123SECRET'
  });
  assert.doesNotMatch(JSON.stringify(sanitized), /ABC123SECRET/);
  assert.equal(sanitized.session.profile.service, 'onepage');
  assert.equal(buildNativeOnepagePortalIntent(sanitized.session.profile).offerHint.site, 'onepage');
  const cancel = choose(sanitized.session, 'cancel_goal');
  assert.equal(cancel.session.profile.service, 'onepage');
  assert.equal(buildNativeOnepagePortalIntent(cancel.session.profile).orderCreated, false);
});

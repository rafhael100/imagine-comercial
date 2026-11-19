import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQualificationJourney, respondQualificationJourney, getQualificationSummary
} from '../ops/faisca/qualification/journey.mjs';
import {
  buildNativeOnepagePortalIntent, NATIVE_ONEPAGE_PORTAL_PIN
} from '../ops/faisca/qualification/portal-native-intent.mjs';

const choose = (session, id) => respondQualificationJourney(session, { type: 'action', id });
function qualified(service = 'goal_presence', consent = 'declined') {
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

test('R58 a complete Onepage visitor may explicitly ask for Portal preparation only', () => {
  for (const consent of ['granted', 'declined', 'later']) {
    const session = qualified('goal_presence', consent);
    const intent = buildNativeOnepagePortalIntent(session.profile);
    assert.equal(intent.portalContractPin, NATIVE_ONEPAGE_PORTAL_PIN);
    assert.equal(intent.offerHint.site, 'onepage');
    assert.equal(intent.orderCreated, false);
    const menu = choose(session, 'r08:next_steps');
    assert.equal(menu.reply.intent, 'r08_next_steps');
    assert.equal(menu.reply.actions.length, 5);
    assert.ok(menu.reply.actions.some(item => item.id === 'r08:prepare_onepage'));
    const preview = choose(menu.session, 'r08:prepare_onepage');
    assert.equal(preview.session, session);
    assert.equal(preview.reply.intent, 'r58_portal_preparation_only');
    assert.equal(preview.userText, 'Ver etapas de contratação Onepage');
    assert.match(preview.reply.text, /Portal Imagine/);
    assert.match(preview.reply.text, /cotação calculada pelo Portal/);
    assert.match(preview.reply.text, /aceite explícito/);
    assert.match(preview.reply.text, /contratação pública ainda não está disponível/);
    assert.match(preview.reply.text, /não criou conta, cotação, pedido, cobrança/);
    assert.deepEqual(preview.reply.sources, []);
    assert.deepEqual(preview.reply.actions.map(action => action.id),
      ['r08:summary', 'r08:next_steps', 'r08:change_service']);
    assert.equal(session.profile.contactConsent, consent);
    assert.doesNotMatch(preview.reply.text, /https?:\/\/|@|R\$\s*\d|token|senha/i);
    assert.match(getQualificationSummary(preview.session), /RASCUNHO NÃO ENVIADO/);
    for(const forbidden of ['checkoutUrl', 'request_key', 'buyerId', 'tenantId', 'price', 'orderId']) {
      assert.ok(!JSON.stringify(preview).includes('"' + forbidden + '"'), forbidden);
    }
  }
});

test('R58 incomplete qualification and Landing Page never present Onepage checkout as available', () => {
  const first = choose(createQualificationJourney(), 'goal_presence');
  const incomplete = choose(first.session, 'r08:prepare_onepage');
  assert.notEqual(incomplete.reply.intent, 'r58_portal_preparation_only');
  assert.doesNotMatch(incomplete.reply.text, /pedido criado|pagamento aprovado/i);

  const started = choose(first.session, 'confirm_goal');
  const early = choose(started.session, 'r08:prepare_onepage');
  assert.equal(early.reply.intent, 'r58_portal_preparation_unavailable');
  assert.equal(early.session.profile.objective, null);

  const landing = qualified('goal_campaign');
  const menu = choose(landing, 'r08:next_steps');
  assert.ok(!menu.reply.actions.some(item => item.id === 'r08:prepare_onepage'));
  const forged = choose(landing, 'r08:prepare_onepage');
  assert.equal(forged.reply.intent, 'r58_portal_preparation_unavailable');
  assert.match(forged.reply.text, /Nenhuma cotação ou pedido foi criado/);
  assert.equal(forged.session.profile.service, 'landing-page');
});

test('R58 pending service switch cannot produce a stale Portal handoff', () => {
  const completed = qualified();
  const changed = choose(completed, 'r08:change_service');
  assert.equal(changed.session.phase, 'service_reselect');
  const denied = choose(changed.session, 'r08:prepare_onepage');
  assert.notEqual(denied.reply.intent, 'r58_portal_preparation_only');
  const pending = choose(changed.session, 'goal_campaign');
  assert.equal(pending.session.phase, 'service_change_pending');
  const attempted = choose(pending.session, 'r08:prepare_onepage');
  assert.equal(attempted.reply.intent, 'r08_service_change_pending');
  assert.equal(attempted.session.profile.service, 'onepage');
  assert.doesNotMatch(attempted.reply.text, /cotação calculada pelo Portal/);
  const reset = choose(pending.session, 'r08:restart');
  assert.equal(reset.session.profile, null);
  assert.notEqual(choose(reset.session, 'r08:prepare_onepage').reply.intent, 'r58_portal_preparation_only');
});

test('R58 the Portal preparation menu never executes a checkout effect or changes profile', () => {
  const completed = qualified();
  const preview1 = choose(completed, 'r08:prepare_onepage');
  const preview2 = choose(preview1.session, 'r08:prepare_onepage');
  assert.equal(preview1.session, completed);
  assert.equal(preview2.session, completed);
  assert.equal(preview1.reply.text, preview2.reply.text);
  assert.equal(preview1.reply.sources.length, 0);
  assert.match(preview1.reply.text, /O Faísca não criou conta/);
  assert.equal(completed.profile.contactConsent, 'declined');
});

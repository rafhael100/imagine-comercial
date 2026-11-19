import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualificationJourney, respondQualificationJourney } from '../ops/faisca/qualification/journey.mjs';
import { buildQualificationNextStep, NEXT_STEP_SCHEMA } from '../ops/faisca/qualification/next-step.mjs';
import { createQualificationPrepareTurn } from '../ops/faisca/qualification/http-runtime.mjs';
import { validateConversationRequest, CONVERSATION_SCHEMA } from '../ops/faisca/conversation-contract.mjs';
import { createConversationOutcome } from '../ops/faisca/conversation-runtime.mjs';
import { createHttpResult } from '../ops/faisca/http-contract.mjs';
import { validateGroundedHttpResult } from '../ops/faisca/grounding/http-policy.mjs';

const choose = (session, id) => respondQualificationJourney(session, { type: 'action', id });

function start(service = 'goal_presence') {
  const pending = choose(createQualificationJourney(), service);
  assert.equal(pending.reply.intent, 'journey_confirmation_needed');
  const confirmed = choose(pending.session, 'confirm_goal');
  assert.equal(confirmed.reply.intent, 'r08_qualification_question');
  return confirmed.session;
}

function complete(session = start(), consent = 'declined') {
  let current = session;
  for (const id of [
    'r08:objective:present_company', 'r08:audience:businesses',
    'r08:materials:ready', 'r08:timeline:within_30_days',
    'r08:contactConsent:' + consent
  ]) current = choose(current, id).session;
  return current;
}

test('R17 only a trusted profile produces copy-only next steps with no operational effects', () => {
  assert.equal(buildQualificationNextStep(null), null);
  assert.equal(buildQualificationNextStep({ service: 'onepage', contactConsent: 'granted' }), null);
  const initial = start();
  const incomplete = buildQualificationNextStep(initial.profile);
  assert.equal(incomplete.schema, NEXT_STEP_SCHEMA);
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.service, 'onepage');
  assert.equal(incomplete.sent, false);
  const profile = complete(initial).profile;
  const guide = buildQualificationNextStep(profile);
  assert.equal(guide.complete, true);
  assert.equal(guide.service, 'onepage');
  assert.equal(guide.delivery, 'copy_only');
  assert.equal(guide.sent, false);
  assert.equal(guide.contactCollected, false);
  assert.equal(guide.orderCreated, false);
  assert.equal(guide.paymentCreated, false);
  assert.equal(guide.ticketCreated, false);
  assert.equal(guide.operationalEffects, false);
  assert.match(guide.text, /Site Onepage/);
  assert.match(guide.text, /proposta oficial/);
  assert.match(guide.text, /Portal Imagine/);
  assert.match(guide.text, /Nenhum contato, pedido, proposta/);
  assert.doesNotMatch(guide.text, /https?:\/\/|@|telefone|99999/);
  assert.equal(Object.isFrozen(guide), true);
});

test('R17 completed qualification shows a six-action menu and a useful next step', () => {
  const completed = complete();
  const view = choose(completed, 'r08:summary');
  assert.equal(view.reply.intent, 'r08_qualification_summary');
  assert.equal(view.reply.actions.length, 6);
  assert.ok(view.reply.actions.some(action => action.id === 'r08:next_steps'));
  assert.ok(view.reply.actions.some(action => action.id === 'r08:edit:contactConsent'));
  const next = choose(view.session, 'r08:next_steps');
  assert.equal(next.reply.intent, 'r08_next_steps');
  assert.equal(next.session, completed, 'A orientação não pode modificar o perfil ou consentimento.');
  assert.equal(next.userText, 'Como avançar?');
  assert.deepEqual(next.reply.sources, []);
  assert.deepEqual(next.reply.actions.map(action => action.id),
    ['r08:summary', 'compare_sites', 'r08:change_service', 'r08:edit:objective',
      'r08:prepare_onepage']);
  assert.match(next.reply.text, /Copie o resumo/);
  assert.equal(completed.profile.contactConsent, 'declined');
  const serviceChange = choose(next.session, 'r08:change_service');
  assert.equal(serviceChange.session.phase, 'service_reselect');
  assert.equal(serviceChange.session.profile, completed.profile);
});

test('R17 incomplete, pending switch, forged and restarted sessions cannot claim ready guidance', () => {
  const initial = createQualificationJourney();
  const unselected = choose(initial, 'r08:next_steps');
  assert.equal(unselected.reply.intent, 'r08_service_choice');
  assert.match(unselected.reply.text, /Primeiro escolha a solução/);

  const partial = start();
  const premature = choose(partial, 'r08:next_steps');
  assert.equal(premature.reply.intent, 'r08_qualification_question');
  assert.match(premature.reply.text, /Primeiro conclua/);
  assert.equal(premature.session.profile.service, 'onepage');
  assert.equal(premature.session.profile.objective, null);

  const completed = complete();
  const change = choose(completed, 'r08:change_service');
  const pending = choose(change.session, 'goal_campaign');
  assert.equal(pending.session.phase, 'service_change_pending');
  const denied = choose(pending.session, 'r08:next_steps');
  assert.equal(denied.reply.intent, 'r08_service_change_pending');
  assert.equal(denied.session.profile.service, 'onepage');
  const reset = choose(denied.session, 'r08:restart');
  assert.equal(reset.session.profile, null);
  assert.equal(buildQualificationNextStep(reset.session.profile), null);
});

test('R17 guidance for Landing Page is neutral and works with deferred or declined consent', () => {
  for (const choice of ['granted', 'declined', 'later']) {
    const session = complete(start('goal_campaign'), choice);
    const result = choose(session, 'r08:next_steps');
    assert.equal(result.reply.intent, 'r08_next_steps');
    assert.match(result.reply.text, /Landing Page/);
    assert.doesNotMatch(result.reply.text, /pedido foi criado|pagamento aprovado|contato registrado/i);
    assert.equal(result.session.profile.contactConsent, choice);
    assert.deepEqual(result.reply.sources, []);
  }
});

test('R17 HTTP action is closed and remains a local non-PHP response', () => {
  const conversationId = 'a'.repeat(32);
  const prepare = createQualificationPrepareTurn(conversationId);
  let flow = prepare(null, { type: 'action', id: 'goal_presence' });
  flow = prepare(flow.session, { type: 'action', id: 'confirm_goal' });
  for (const id of [
    'r08:objective:present_company', 'r08:audience:businesses',
    'r08:materials:ready', 'r08:timeline:within_30_days',
    'r08:contactConsent:declined'
  ]) flow = prepare(flow.session, { type: 'action', id });
  assert.equal(flow.reply.intent, 'r08_qualification_complete');
  assert.equal(flow.reply.actions.length, 6);
  const next = prepare(flow.session, { type: 'action', id: 'r08:next_steps' });
  assert.equal(next.reply.intent, 'r08_next_steps');
  assert.equal(next.providerReply, undefined);
  const request = validateConversationRequest({
    schema: CONVERSATION_SCHEMA, conversationId,
    messageId: 'r17_next_steps_0001', locale: 'pt-BR',
    input: { type: 'action', id: 'r08:next_steps' }
  });
  assert.ok(request);
  const outcome = createConversationOutcome('answered', {
    reply: next.reply, accepted: true, delivery: 'guided_fallback', reason: 'r08_next_steps'
  });
  assert.equal(validateGroundedHttpResult(createHttpResult(request, outcome),
    request, next.reply), true);
  assert.deepEqual(next.reply.sources, []);
});

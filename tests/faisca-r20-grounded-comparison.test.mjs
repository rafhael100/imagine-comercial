import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualificationJourney, respondQualificationJourney } from '../ops/faisca/qualification/journey.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';
import { createQualificationPrepareTurn } from '../ops/faisca/qualification/http-runtime.mjs';
import { validateConversationRequest, CONVERSATION_SCHEMA } from '../ops/faisca/conversation-contract.mjs';
import { createConversationOutcome } from '../ops/faisca/conversation-runtime.mjs';
import { createHttpResult } from '../ops/faisca/http-contract.mjs';
import { validateGroundedHttpResult } from '../ops/faisca/grounding/http-policy.mjs';

const choose = (session, id) => respondQualificationJourney(session, { type: 'action', id });

function completed(service = 'goal_presence') {
  let flow = choose(createQualificationJourney(), service);
  flow = choose(flow.session, 'confirm_goal');
  for (const id of [
    'r08:objective:capture_leads', 'r08:audience:businesses',
    'r08:materials:ready', 'r08:timeline:within_30_days',
    'r08:contactConsent:declined'
  ]) flow = choose(flow.session, id);
  return flow.session;
}

test('R20 the next-step comparison option preserves the sales profile and invokes approved R06 content', () => {
  const session = completed();
  const guide = choose(session, 'r08:next_steps');
  assert.equal(guide.reply.intent, 'r08_next_steps');
  assert.ok(guide.reply.actions.some(action => action.id === 'compare_sites'));
  assert.equal(guide.reply.actions.length, 4);
  assert.deepEqual(guide.reply.sources, []);

  const comparison = choose(guide.session, 'compare_sites');
  const approved = getGroundedAnswer('compare_sites');
  assert.equal(comparison.reply.intent, 'r08_qualification_complete');
  assert.equal(comparison.session.phase, 'complete');
  assert.equal(comparison.session.profile, session.profile);
  assert.equal(comparison.session.profile.service, 'onepage');
  assert.equal(comparison.session.profile.objective, 'capture_leads');
  assert.equal(comparison.session.profile.contactConsent, 'declined');
  assert.equal(comparison.providerReply.intent, 'compare_sites');
  assert.equal(comparison.providerReply.text, approved.text);
  assert.deepEqual(comparison.providerReply.sources, approved.sources);
  assert.ok(comparison.reply.text.includes(approved.text));
  assert.deepEqual(comparison.reply.sources, approved.sources);
  assert.match(comparison.reply.text, /RASCUNHO NÃO ENVIADO/);
  assert.equal(comparison.reply.actions.length, 6);
  assert.ok(comparison.reply.actions.some(action => action.id === 'r08:next_steps'));
});

test('R20 compares but never changes the selected solution without explicit confirmation', () => {
  const session = completed('goal_campaign');
  const comparison = choose(choose(session, 'r08:next_steps').session, 'compare_sites');
  assert.equal(comparison.session.profile.service, 'landing-page');
  assert.equal(comparison.session.profile.contactConsent, 'declined');
  const next = choose(comparison.session, 'r08:next_steps');
  assert.equal(next.reply.intent, 'r08_next_steps');
  assert.equal(next.session.profile.service, 'landing-page');
  const change = choose(next.session, 'r08:change_service');
  assert.equal(change.session.phase, 'service_reselect');
  assert.equal(change.session.profile.service, 'landing-page');
  const cancel = choose(change.session, 'r08:keep_service');
  assert.equal(cancel.session.profile.service, 'landing-page');
});

test('R20 HTTP comparison requires the exact editorial PHP candidate, not an arbitrary local answer', () => {
  const conversationId = 'b'.repeat(32), prepare = createQualificationPrepareTurn(conversationId);
  let flow = prepare(null, { type: 'action', id: 'goal_presence' });
  flow = prepare(flow.session, { type: 'action', id: 'confirm_goal' });
  for (const id of [
    'r08:objective:capture_leads', 'r08:audience:businesses',
    'r08:materials:ready', 'r08:timeline:within_30_days',
    'r08:contactConsent:declined'
  ]) flow = prepare(flow.session, { type: 'action', id });
  flow = prepare(flow.session, { type: 'action', id: 'r08:next_steps' });
  assert.equal(flow.providerReply, undefined);
  const compare = prepare(flow.session, { type: 'action', id: 'compare_sites' });
  assert.equal(compare.providerReply.intent, 'compare_sites');
  assert.ok(compare.providerReply.sources.length > 0);
  const request = validateConversationRequest({
    schema: CONVERSATION_SCHEMA, conversationId, messageId: 'r20_comparison_0001',
    locale: 'pt-BR', input: { type: 'action', id: 'compare_sites' }
  });
  assert.ok(request);
  const response = createHttpResult(request, createConversationOutcome('answered', {
    reply: compare.reply, accepted: true, delivery: 'simulated', reason: 'answered'
  }));
  assert.equal(validateGroundedHttpResult(response, request, compare.reply, compare.providerReply), true);
  const missingGrounding = Object.freeze({ ...compare.reply, sources: Object.freeze([]) });
  const altered = createHttpResult(request, createConversationOutcome('answered', {
    reply: missingGrounding, accepted: true, delivery: 'simulated', reason: 'answered'
  }));
  assert.equal(validateGroundedHttpResult(altered, request, compare.reply, compare.providerReply), false);
});

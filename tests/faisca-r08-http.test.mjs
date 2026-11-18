import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConversationRequest, CONVERSATION_SCHEMA } from '../ops/faisca/conversation-contract.mjs';
import { createHttpResult, validateHttpResult } from '../ops/faisca/http-contract.mjs';
import { createQualificationPrepareTurn } from '../ops/faisca/qualification/http-runtime.mjs';
import { getQualificationSummary } from '../ops/faisca/qualification/journey.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';
import { createConversationRuntime } from '../ops/faisca/conversation-runtime.mjs';

function request(input, messageId = 'r08_http_message_0001', conversationId = 'a'.repeat(32)) {
  return validateConversationRequest({
    schema: CONVERSATION_SCHEMA, conversationId, messageId, locale: 'pt-BR', input
  });
}

test('R08 HTTP contract accepts only the closed qualification actions', () => {
  for (const id of [
    'confirm_goal', 'cancel_goal', 'r08:summary', 'r08:change_service', 'r08:restart',
    'r08:edit:objective', 'r08:edit:audience', 'r08:edit:materials',
    'r08:edit:timeline', 'r08:edit:contactConsent',
    'r08:objective:present_company', 'r08:objective:capture_leads',
    'r08:audience:businesses', 'r08:materials:ready',
    'r08:timeline:within_30_days', 'r08:contactConsent:granted'
  ]) assert.ok(request({ type: 'action', id }), id);
  for (const id of ['r08:objective:email', 'r08:contactConsent:phone',
    'r08:service:crm', 'r08:edit:email', 'r08:unknown']) {
    assert.equal(request({ type: 'action', id }), null, id);
  }
});

test('R08 HTTP prepare factory requires a server-issued opaque conversation ID', () => {
  for (const value of [null, '', 'short', 'g'.repeat(32), 'a'.repeat(31)]) {
    assert.throws(() => createQualificationPrepareTurn(value), TypeError);
  }
  assert.equal(typeof createQualificationPrepareTurn('a'.repeat(32)), 'function');
});

test('R08 HTTP session keeps proposal and qualification local, then exposes only the R07 answer as provider candidate', () => {
  const prepare = createQualificationPrepareTurn('a'.repeat(32));
  let result = prepare(null, { type: 'text', text: 'Quero apresentar minha empresa.' });
  assert.equal(result.reply.intent, 'journey_confirmation_needed');
  assert.equal(result.providerReply, undefined);
  let session = result.session;

  result = prepare(session, { type: 'action', id: 'confirm_goal' });
  assert.equal(result.reply.intent, 'r08_qualification_question');
  assert.equal(result.providerReply.intent, 'goal_presence');
  assert.match(result.reply.text, /Qual é o principal resultado/);
  session = result.session;

  result = prepare(session, { type: 'action', id: 'r08:objective:present_company' });
  assert.equal(result.reply.intent, 'r08_qualification_question');
  assert.equal(result.providerReply, undefined);
  assert.match(result.reply.text, /Quem você deseja alcançar/);
  assert.match(getQualificationSummary(result.session), /Site Onepage/);
});

test('R08 HTTP grounded FAQ retains the R08 profile while the PHP candidate stays exact R07 editorial text', () => {
  const prepare = createQualificationPrepareTurn('b'.repeat(32));
  let result = prepare(null, { type: 'action', id: 'goal_campaign' });
  assert.equal(result.reply.intent, 'journey_confirmation_needed');
  result = prepare(result.session, { type: 'action', id: 'confirm_goal' });
  assert.equal(result.providerReply.intent, 'goal_campaign');
  let session = result.session;
  for (const [field, value] of [
    ['objective', 'capture_leads'], ['audience', 'businesses'],
    ['materials', 'ready'], ['timeline', 'within_90_days'], ['contactConsent', 'declined']
  ]) session = prepare(session, { type: 'action', id: 'r08:' + field + ':' + value }).session;
  result = prepare(session, { type: 'text', text: 'Como funciona o projeto?' });
  assert.equal(result.reply.intent, 'r08_qualification_complete');
  assert.equal(result.providerReply.intent, 'process');
  assert.ok(result.reply.text.includes(getGroundedAnswer('process').text));
  assert.match(result.reply.text, /RASCUNHO NÃO ENVIADO/);
  assert.match(getQualificationSummary(result.session), /Landing Page/);
  assert.match(getQualificationSummary(result.session), /Não concedida/);
});

test('R08 HTTP runtime dispatches only the exact R07 provider candidate and keeps R08 presentation', async () => {
  let dispatched = 0;
  const provider = {
    kind: 'simulated',
    async respond(_request, { candidate }) { dispatched++; return candidate; }
  };
  const conversationId = 'c'.repeat(32);
  const runtime = createConversationRuntime({
    provider, prepareTurn: createQualificationPrepareTurn(conversationId), timeoutMs: 500
  });
  const send = (messageId, input) => runtime.send({
    schema: CONVERSATION_SCHEMA, conversationId, messageId, locale: 'pt-BR', input
  });
  try {
    const proposal = await send('r08_runtime_proposal_01', { type: 'text', text: 'Quero apresentar minha empresa.' });
    assert.equal(proposal.status, 'answered');
    assert.equal(proposal.delivery, 'guided_fallback');
    assert.equal(dispatched, 0);

    const confirmation = await send('r08_runtime_confirm_01', { type: 'action', id: 'confirm_goal' });
    assert.equal(confirmation.status, 'answered');
    assert.equal(confirmation.delivery, 'simulated');
    assert.equal(confirmation.reply.intent, 'r08_qualification_question');
    assert.match(confirmation.reply.text, /Qual é o principal resultado/);
    assert.equal(confirmation.reply.sources.length, getGroundedAnswer('goal_presence').sources.length);
    assert.equal(dispatched, 1);

    const objective = await send('r08_runtime_objective_01', { type: 'action', id: 'r08:objective:present_company' });
    assert.equal(objective.status, 'answered');
    assert.equal(objective.delivery, 'guided_fallback');
    assert.match(objective.reply.text, /Quem você deseja alcançar/);
    assert.equal(dispatched, 1);

    const faq = await send('r08_runtime_faq_0001', { type: 'text', text: 'Como funciona o projeto?' });
    assert.equal(faq.status, 'answered');
    assert.equal(faq.delivery, 'simulated');
    assert.equal(faq.reply.intent, 'r08_qualification_question');
    assert.ok(faq.reply.text.includes(getGroundedAnswer('process').text));
    assert.match(faq.reply.text, /Quem você deseja alcançar/);
    assert.equal(faq.reply.sources.length, getGroundedAnswer('process').sources.length);
    assert.equal(dispatched, 2);
  } finally { runtime.destroy(); }
});

test('R09 natural-language qualification reply is a valid closed HTTP result with no PHP dispatch', async () => {
  let providerCalls = 0;
  const runtime = createConversationRuntime({
    provider: {
      kind: 'simulated',
      respond(_request, { candidate }) { providerCalls++; return candidate; }
    },
    prepareTurn: createQualificationPrepareTurn('c'.repeat(32)),
    timeoutMs: 500
  });
  const send = async (messageId, input) => {
    const envelope = request(input, messageId, 'c'.repeat(32));
    const outcome = await runtime.send(envelope);
    const wire = createHttpResult(envelope, outcome);
    assert.ok(validateHttpResult(wire, envelope));
    return outcome;
  };
  try {
    const proposal = await send('r09_http_proposal_0001',
      { type: 'text', text: 'Quero apresentar minha empresa.' });
    assert.equal(proposal.reply.intent, 'journey_confirmation_needed');
    assert.equal(providerCalls, 0);

    const confirmed = await send('r09_http_confirm_0001', { type: 'action', id: 'confirm_goal' });
    assert.equal(confirmed.reply.intent, 'r08_qualification_question');
    assert.equal(providerCalls, 1);

    const freeText = await send('r09_http_field_0001',
      { type: 'text', text: 'Quero captar leads interessados.' });
    assert.equal(freeText.reply.intent, 'r08_qualification_question');
    assert.match(freeText.reply.text, /Quem você deseja alcançar/);
    assert.equal(freeText.delivery, 'guided_fallback');
    assert.equal(providerCalls, 1, 'Closed field classification must not dispatch PHP.');
  } finally { runtime.destroy(); }
});

test('R08 pending service change preserves the old profile and remains a local HTTP turn', async () => {
  let providerCalls = 0;
  const runtime = createConversationRuntime({
    provider: {
      kind: 'simulated',
      respond(_request, { candidate }) { providerCalls++; return candidate; }
    },
    prepareTurn: createQualificationPrepareTurn('d'.repeat(32)),
    timeoutMs: 500
  });
  const send = async (messageId, input) => {
    const envelope = request(input, messageId, 'd'.repeat(32));
    const outcome = await runtime.send(envelope);
    const wire = createHttpResult(envelope, outcome);
    assert.ok(validateHttpResult(wire, envelope));
    return outcome;
  };
  try {
    let outcome = await send('r08_change_proposal_01',
      { type: 'text', text: 'Quero apresentar minha empresa.' });
    outcome = await send('r08_change_confirm_01', { type: 'action', id: 'confirm_goal' });
    assert.equal(outcome.reply.intent, 'r08_qualification_question');
    assert.equal(providerCalls, 1);

    outcome = await send('r08_change_objective_01',
      { type: 'text', text: 'Quero apresentar minha empresa.' });
    assert.equal(outcome.reply.intent, 'r08_qualification_question');
    assert.equal(providerCalls, 1);

    outcome = await send('r08_change_propose_02',
      { type: 'text', text: 'Na verdade prefiro Landing Page.' });
    assert.equal(outcome.reply.intent, 'journey_confirmation_needed');
    assert.match(outcome.reply.text, /troca de solução está pendente/);
    assert.equal(outcome.delivery, 'guided_fallback');
    assert.equal(providerCalls, 1);

    outcome = await send('r08_change_pending_text_01',
      { type: 'text', text: 'Quanto custa a Landing Page?' });
    assert.equal(outcome.reply.intent, 'r08_service_change_pending');
    assert.equal(providerCalls, 1);

    outcome = await send('r08_change_cancel_02', { type: 'action', id: 'cancel_goal' });
    assert.equal(outcome.reply.intent, 'r08_qualification_question');
    assert.match(outcome.reply.text, /Quem você deseja alcançar/);
    assert.equal(providerCalls, 1);
  } finally { runtime.destroy(); }
});

test('R08 HTTP factories isolate confirmed services and profile state between sessions', () => {
  const prepareA = createQualificationPrepareTurn('a'.repeat(32));
  const prepareB = createQualificationPrepareTurn('b'.repeat(32));
  let a = prepareA(null, { type: 'text', text: 'Quero apresentar minha empresa.' });
  let b = prepareB(null, { type: 'action', id: 'goal_campaign' });
  a = prepareA(a.session, { type: 'action', id: 'confirm_goal' });
  b = prepareB(b.session, { type: 'action', id: 'confirm_goal' });
  a = prepareA(a.session, { type: 'action', id: 'r08:objective:present_company' });
  b = prepareB(b.session, { type: 'action', id: 'r08:objective:capture_leads' });
  assert.match(getQualificationSummary(a.session), /Site Onepage/);
  assert.match(getQualificationSummary(b.session), /Landing Page/);
  assert.match(getQualificationSummary(a.session), /Apresentar a empresa/);
  assert.match(getQualificationSummary(b.session), /Captar contatos/);
  assert.doesNotMatch(getQualificationSummary(a.session), /Landing Page/);
  assert.doesNotMatch(getQualificationSummary(b.session), /Site Onepage/);
});

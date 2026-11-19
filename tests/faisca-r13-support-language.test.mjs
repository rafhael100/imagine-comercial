import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond } from '../ops/faisca/core.mjs';
import { groundedRespond } from '../ops/faisca/grounding/guide.mjs';
import { routeWithLocalFixture, localModelRouteFixture } from '../ops/faisca/model-router/contract.mjs';
import { createModelRouteRuntime } from '../ops/faisca/model-router/runtime.mjs';

const privateSamples = Object.freeze([
  ['Preciso da segunda via do recibo.', 'support_billing'],
  ['Quero a segunda via da nota.', 'support_billing'],
  ['Quero o estorno da última cobrança.', 'support_billing'],
  ['Qual o valor do meu plano atual?', 'support_billing'],
  ['Quando vence minha assinatura?', 'support_billing'],
  ['Quero mudar meu plano contratado.', 'support_cancel'],
  ['Preciso pausar minha campanha.', 'support_cancel'],
  ['Tenho um problema no site que contratei.', 'support_issue'],
  ['O site que contratei está com erro.', 'support_issue'],
  ['Não consigo acessar o Portal.', 'after_sales'],
  ['Como entrar na área de cliente?', 'after_sales']
]);

function message(userText, index) {
  return { conversationId: 'r13_safe_dialogue', messageId: 'r13_message_' + index, userText };
}

test('R13 private post-sale language routes consistently through guide, R06 and R09', () => {
  for (const [index, [userText, expectedIntent]] of privateSamples.entries()) {
    const initial = respond(createSession(), { type: 'text', text: userText });
    assert.equal(initial.reply.intent, expectedIntent, userText);
    const grounded = groundedRespond(createSession(), { type: 'text', text: userText });
    assert.equal(grounded.reply.intent, 'grounding_boundary', userText);
    assert.deepEqual(grounded.reply.sources, [], userText);
    assert.doesNotMatch(grounded.reply.text, /pedido confirmado|pagamento aprovado|chamado aberto/i);
    const routed = routeWithLocalFixture(message(userText, index));
    assert.equal(routed.accepted, true, userText);
    assert.equal(routed.routeStatus, 'authentication_required', userText);
    assert.equal(routed.provenance, 'host_fixed_boundary', userText);
    assert.deepEqual(routed.sources, [], userText);
    assert.deepEqual(routed.actions, [], userText);
    assert.deepEqual(routed.candidateAnswerIds, [], userText);
  }
});

test('R13 post-sale questions never dispatch to a simulated model provider', async () => {
  let dispatches = 0;
  const runtime = createModelRouteRuntime({ provider: {
    kind: 'simulated',
    route(request) { dispatches++; return localModelRouteFixture(request); }
  } });
  try {
    for (const [index, [userText]] of privateSamples.entries()) {
      const answer = await runtime.send(message(userText, index));
      assert.equal(answer.status, 'answered', userText);
      assert.equal(answer.delivery, 'fixed_boundary', userText);
      assert.equal(answer.route.routeStatus, 'authentication_required', userText);
      assert.equal(answer.externalModelInvocations, 0, userText);
      assert.equal(answer.operationalEffects, false, userText);
    }
    assert.equal(dispatches, 0);
    assert.equal(runtime.inspect().dispatched, 0);
  } finally { runtime.destroy(); }
});

test('R13 public questions remain useful and do not become post-sale topics', () => {
  const samples = [
    ['Quanto custa uma Landing Page?', 'pricing', 'pricing'],
    ['Como funciona o projeto?', 'process', 'process'],
    ['Quero apresentar minha empresa.', 'goal_presence', 'goal_presence'],
    ['Qual a diferença entre Onepage e Landing Page?', 'compare_sites', 'compare_sites'],
    ['Quero anunciar no Instagram.', 'channel_meta', 'channel_meta']
  ];
  for (const [index, [text, coreIntent, answerId]] of samples.entries()) {
    assert.equal(respond(createSession(), { type: 'text', text }).reply.intent, coreIntent, text);
    const route = routeWithLocalFixture(message(text, 'public_' + index));
    assert.equal(route.routeStatus, 'grounded', text);
    assert.equal(route.answerId, answerId, text);
    assert.ok(route.sources.length > 0, text);
    assert.equal(route.provenance, 'r06_verified_editorial', text);
  }
});

test('R13 sensitive text remains hidden rather than being interpreted as support', () => {
  const sample = 'Tenho problema no site que contratei e minha senha é exemplo_de_teste.';
  const guided = respond(createSession(), { type: 'text', text: sample });
  assert.equal(guided.reply.intent, 'sensitive_input');
  assert.doesNotMatch(guided.userText, /exemplo_de_teste/);
  const grounded = groundedRespond(createSession(), { type: 'text', text: sample });
  assert.equal(grounded.reply.intent, 'sensitive_input');
  const route = routeWithLocalFixture(message(sample, 'sensitive'));
  assert.equal(route.accepted, false);
  assert.deepEqual(route.sources, []);
  assert.doesNotMatch(route.text, /exemplo_de_teste/);
});

test('R13 no new public facts, actions or user data are introduced by safety classification', () => {
  for (const [index, [userText]] of privateSamples.entries()) {
    const outcome = routeWithLocalFixture(message(userText, 'immut_' + index));
    assert.ok(Object.isFrozen(outcome));
    assert.ok(Object.isFrozen(outcome.sources));
    assert.ok(Object.isFrozen(outcome.actions));
    assert.equal('ticketCreated' in outcome, false);
    assert.equal('paymentStatus' in outcome, false);
    assert.equal('providerText' in outcome, false);
    assert.equal('customerId' in outcome, false);
  }
});

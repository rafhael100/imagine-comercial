import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareModelRouteRequest, routeWithLocalFixture
} from '../ops/faisca/model-router/contract.mjs';

const run = (text, suffix) => routeWithLocalFixture({
  conversationId: 'r11_anonymous_conversation',
  messageId: 'r11_anonymous_message_' + suffix,
  userText: text
});

test('R11 anonymous post-sale and billing questions are never answered as public product facts', () => {
  for (const [question, marker] of [
    ['Qual o andamento do meu pedido?', 'pedido'],
    ['Quando ficará pronto o meu projeto?', 'projeto'],
    ['Quero confirmar minha fatura.', 'Cobranças'],
    ['Quero cancelar meu contrato.', 'Cancelamentos'],
    ['Meu site não funciona.', 'suporte']
  ]) {
    const result = run(question, String(question.length));
    assert.equal(result.accepted, true, question);
    assert.equal(result.routeStatus, 'authentication_required', question);
    assert.match(result.text, new RegExp(marker, 'i'), question);
    assert.equal(result.provenance, 'host_fixed_boundary');
    assert.deepEqual(result.sources, []);
    assert.deepEqual(result.actions, []);
    assert.deepEqual(result.candidateAnswerIds, []);
    assert.equal(result.answerId, undefined);
  }
});

test('R11 human, privacy and unverified CRM requests use safe fixed host copy', () => {
  const requests = [
    ['Quero falar com um atendente.', 'human_handoff', /Não há atendente conectado/],
    ['Tenho dúvidas sobre privacidade.', 'privacy_guidance', /Não envie senhas/],
    ['O CRM tem automações?', 'product_unverified', /recursos e a contratação/]
  ];
  for (const [question, status, expectedText] of requests) {
    const result = run(question, String(status.length));
    assert.equal(result.routeStatus, status);
    assert.match(result.text, expectedText);
    assert.deepEqual(result.sources, []);
    assert.deepEqual(result.candidateAnswerIds, []);
  }
});

test('R11 direct model-route contract refuses private requests regardless of supplied candidate IDs', () => {
  for (const question of [
    'Qual o andamento do meu pedido?',
    'Quero confirmar minha fatura.',
    'Quero cancelar meu contrato.',
    'Quero falar com um atendente.',
    'O CRM tem automações?'
  ]) {
    const request = prepareModelRouteRequest({
      conversationId: 'r11_closed_conversation',
      messageId: 'r11_private_message_0001',
      userText: question,
      candidateAnswerIds: ['goal_presence', 'pricing'],
      allowedClarificationIds: ['service_choice']
    });
    assert.equal(request, null, question);
  }
});

test('R11 legitimate public pricing and process questions retain reviewed R06 answers', () => {
  const price = run('Quanto custa uma Landing Page?', 'price');
  assert.equal(price.accepted, true);
  assert.equal(price.routeStatus, 'grounded');
  assert.equal(price.answerId, 'pricing');
  assert.ok(price.sources.length >= 1);
  const process = run('Como funciona o projeto?', 'process');
  assert.equal(process.accepted, true);
  assert.equal(process.answerId, 'process');
  assert.ok(process.sources.length >= 1);
});

test('R11 field getters in caller options cannot run and cannot bypass the boundary', () => {
  let reads = 0;
  const input = {
    conversationId: 'r11_anonymous_conversation',
    messageId: 'r11_anonymous_message_getter',
    userText: 'Qual status do meu pedido?'
  };
  Object.defineProperty(input, 'userText', {
    enumerable: true, get() { reads++; return 'Quanto custa?'; }
  });
  const result = routeWithLocalFixture(input);
  assert.equal(result.accepted, false);
  assert.equal(result.routeStatus, 'refused');
  assert.equal(reads, 0);
});

test('R11 sensitive personal information is refused before any boundary or source is returned', () => {
  const result = run('Meu telefone é +55 85 99999-9999 e quero saber do pedido.', 'pii');
  assert.equal(result.accepted, false);
  assert.equal(result.routeStatus, 'refused');
  assert.deepEqual(result.sources, []);
  assert.doesNotMatch(result.text, /99999/);
});

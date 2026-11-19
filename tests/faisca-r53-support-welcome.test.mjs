import test from 'node:test';
import assert from 'node:assert/strict';
import { getWelcome } from '../ops/faisca/core.mjs';
import { getSupportWelcome } from '../ops/faisca/support/support-ui.mjs';
import { createSupportJourney, respondSupportJourney } from '../ops/faisca/support/journey.mjs';

test('R53 uses a dedicated anonymous-support greeting instead of inviting sensitive free text', () => {
  const greeting = getSupportWelcome();
  assert.equal(greeting.intent, 'r10_support_welcome');
  assert.equal(greeting.state, 'TALK');
  assert.equal(greeting.sources.length, 0);
  assert.deepEqual(greeting.actions.map(item => item.id), ['after_sales']);
  assert.match(greeting.text, /prévia anônima/);
  assert.match(greeting.text, /Não digite dados pessoais ou senhas/);
  assert.match(greeting.text, /não abre tickets/);
  assert.doesNotMatch(greeting.text, /escreva sua dúvida|envie sua mensagem/i);
  assert.equal(Object.isFrozen(greeting), true);
  assert.equal(Object.isFrozen(greeting.actions), true);
  assert.equal(Object.isFrozen(greeting.actions[0]), true);
});

test('R53 preserves the original guided welcome for the other local demos', () => {
  const old = getWelcome();
  assert.notEqual(old.intent, getSupportWelcome().intent);
  assert.ok(old.actions.some(a => a.id === 'sell'));
  assert.ok(old.actions.some(a => a.id === 'faq'));
  assert.deepEqual(getSupportWelcome().actions.map(a => a.id), ['after_sales']);
});

test('R53 greeting enables a valid local support journey without identity or effects', () => {
  const button = getSupportWelcome().actions[0];
  const result = respondSupportJourney(createSupportJourney(), { type: 'action', id: button.id });
  assert.equal(result.reply.intent, 'r10_support_question');
  assert.equal(result.session.triage.topic, null);
  assert.equal(result.session.triage.service, null);
  assert.equal(result.session.triage.detail, null);
  assert.deepEqual(result.reply.sources, []);
  assert.match(result.reply.text, /Qual é o assunto/);
  assert.ok(result.reply.actions.every(a => a.id.startsWith('r10:')));
});

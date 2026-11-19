import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond } from '../ops/faisca/core.mjs';
import { createModelRouteRuntime } from '../ops/faisca/model-router/runtime.mjs';
import { prepareFieldRouteRequest } from '../ops/faisca/model-router/field-contract.mjs';
import { createQualificationJourney, respondQualificationJourney } from '../ops/faisca/qualification/journey.mjs';

const cases = Object.freeze([
  'Minha chave Pix: 123e4567-e89b-12d3-a456-426614174000',
  'Minha chave aleatória Pix é alfa-beta-gama-delta',
  'Pix copia e cola: 00020101021112345',
  'Meu RG é 12.345.678-9',
  'RG: 12.345.678-9',
  'Meu CEP é 60123-456',
  'CEP: 60123-456',
  'Minha chave pix é abcdefghijklmnopqrst',
  'https://example.invalid/acesso?access_token=SECRET_VALUE',
  'https://example.invalid/callback?session=SECRET_VALUE',
  'Authorization: Bearer EXAMPLE_SECRET_VALUE'
]);
const msg = (text, index) => ({
  conversationId: 'r32_conversation', messageId: 'r32_message_' + index, userText: text
});

test('R32 hides Pix identifiers, short RG/CEP and login tokens from all visible core output', () => {
  for (const text of cases) {
    const answer = respond(createSession(), { type: 'text', text });
    assert.equal(answer.reply.intent, 'sensitive_input', text);
    assert.equal(answer.userText, '[Mensagem com possível dado pessoal ou credencial ocultada]');
    assert.equal(JSON.stringify(answer).includes(text), false);
    assert.equal(answer.session.goal, null);
    assert.deepEqual(answer.reply.sources, []);
  }
});

test('R32 refuses all personal credentials before the R09 provider can dispatch', async () => {
  let calls = 0;
  const runtime = createModelRouteRuntime({ provider: {
    kind: 'simulated', route() { calls++; throw new Error('Private input dispatched'); }
  } });
  try {
    for (const [index, text] of cases.entries()) {
      const outcome = await runtime.send(msg(text, index));
      assert.equal(outcome.status, 'invalid_request', text);
      assert.equal(outcome.externalModelInvocations, 0);
      assert.equal(outcome.route, null);
    }
    assert.equal(calls, 0);
    assert.equal(runtime.inspect().dispatched, 0);
  } finally { runtime.destroy(); }
});

test('R32 private identifiers cannot be interpreted as commercial qualification fields', () => {
  for (const [index, text] of cases.entries()) {
    const request = prepareFieldRouteRequest({
      conversationId: 'r32_field_session', messageId: 'r32_field_' + index,
      userText: text + ' quero captar contatos', field: 'objective'
    });
    assert.equal(request, null, text);
  }
});

test('R32 free-text qualification keeps selected service, never echoes the sensitive text', () => {
  let current = respondQualificationJourney(createQualificationJourney(), {
    type: 'action', id: 'goal_presence'
  }).session;
  current = respondQualificationJourney(current, { type: 'action', id: 'confirm_goal' }).session;
  assert.equal(current.profile.service, 'onepage');
  assert.equal(current.profile.objective, null);
  for (const text of cases.slice(0, 7)) {
    const response = respondQualificationJourney(current, { type: 'text', text });
    assert.equal(response.session.profile.service, 'onepage');
    assert.equal(response.session.profile.objective, null);
    assert.equal(JSON.stringify(response).includes(text), false);
    assert.deepEqual(response.reply.sources, []);
    current = response.session;
  }
});

test('R32 ordinary public pricing and solution questions are not mistaken for private identifiers', () => {
  for (const text of [
    'Vocês aceitam Pix?',
    'Quais soluções de site a Imagine oferece?',
    'Qual a diferença entre Onepage e Landing Page?',
    'Como funciona o projeto?'
  ]) {
    const response = respond(createSession(), { type: 'text', text });
    assert.notEqual(response.reply.intent, 'sensitive_input', text);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareFieldRouteRequest, verifyFieldRouteResponse, localFieldRouteFixture,
  routeFieldWithLocalFixture, FIELD_REQUEST_SCHEMA, FIELD_RESPONSE_SCHEMA
} from '../ops/faisca/model-router/field-contract.mjs';
import { getQualificationFieldOptions } from '../ops/faisca/qualification/profile.mjs';

function request(field, userText, messageId = 'r09_field_message_01') {
  return prepareFieldRouteRequest({
    conversationId: 'r09_field_conversation_01', messageId, userText, field
  });
}

test('R09 field router uses only the closed qualification option catalog', () => {
  for (const field of ['objective', 'audience', 'materials', 'timeline', 'contactConsent']) {
    const options = getQualificationFieldOptions(field);
    assert.ok(options.length >= 2 && options.length <= 5);
    const prepared = request(field, 'Resposta de teste.');
    assert.equal(prepared.schema, FIELD_REQUEST_SCHEMA);
    assert.equal(prepared.field, field);
    assert.match(prepared.invocationId, /^[a-f0-9]{32}$/);
    assert.deepEqual(prepared.allowedOptions, options);
    assert.equal('profile' in prepared, false);
    assert.equal('contact' in prepared, false);
  }
  assert.equal(request('email', 'meu e-mail é teste@example.com'), null);
});

test('R09 field fixture maps natural Portuguese answers to explicit enum values', () => {
  const examples = [
    ['objective', 'Quero apresentar minha empresa.', 'present_company'],
    ['objective', 'Quero captar leads interessados.', 'capture_leads'],
    ['objective', 'Quero vender online.', 'sell_online'],
    ['objective', 'Quero facilitar o primeiro contato.', 'organize_service'],
    ['objective', 'Ainda não defini.', 'not_specified'],
    ['audience', 'Quero alcançar outras empresas.', 'businesses'],
    ['audience', 'Ainda não sei.', 'not_specified'],
    ['audience', 'Quero chegar aos clientes da minha região.', 'local_customers'],
    ['audience', 'Quero falar com consumidores online.', 'online_consumers'],
    ['audience', 'Quero atender os clientes atuais.', 'existing_clients'],
    ['materials', 'Já tenho textos e imagens.', 'ready'],
    ['materials', 'Preciso de ajuda com o conteúdo.', 'need_support'],
    ['materials', 'Ainda não sei.', 'not_specified'],
    ['timeline', 'Quero iniciar nos próximos 30 dias.', 'within_30_days'],
    ['timeline', 'Prefiro não informar.', 'not_specified'],
    ['timeline', 'Minha previsão é em 90 dias.', 'within_90_days'],
    ['timeline', 'Estou sem prazo definido.', 'flexible'],
    ['contactConsent', 'Sim, autorizo.', 'granted'],
    ['contactConsent', 'Não autorizo contato.', 'declined'],
    ['contactConsent', 'Prefiro decidir depois.', 'later']
  ];
  for (const [field, userText, expected] of examples) {
    const result = routeFieldWithLocalFixture({
      conversationId: 'r09_field_conversation_02',
      messageId: 'r09_field_' + expected,
      userText, field
    });
    assert.equal(result.accepted, true, field + ': ' + userText);
    assert.equal(result.status, 'matched', field + ': ' + userText);
    assert.equal(result.value, expected, field + ': ' + userText);
  }
});

test('R09 field fixture distinguishes ambiguous and unknown answers without guessing', () => {
  const ambiguous = routeFieldWithLocalFixture({
    conversationId: 'r09_field_conversation_03', messageId: 'r09_field_ambiguous_01',
    userText: 'Quero alcançar outras empresas e consumidores online.', field: 'audience'
  });
  assert.equal(ambiguous.accepted, true);
  assert.equal(ambiguous.status, 'ambiguous');
  assert.equal(ambiguous.value, null);

  const unknown = routeFieldWithLocalFixture({
    conversationId: 'r09_field_conversation_03', messageId: 'r09_field_unknown_01',
    userText: 'Ainda estou pensando em algumas possibilidades.', field: 'audience'
  });
  assert.equal(unknown.accepted, true);
  assert.equal(unknown.status, 'unknown');
  assert.equal(unknown.value, null);
});

test('R09 field verifier refuses stale, cross-field, extra-field and unapproved values', () => {
  const req = request('objective', 'Quero captar leads.');
  const candidate = localFieldRouteFixture(req);
  assert.equal(candidate.schema, FIELD_RESPONSE_SCHEMA);
  assert.equal(verifyFieldRouteResponse(req, candidate).value, 'capture_leads');
  for (const altered of [
    { ...candidate, invocationId: 'stale_invocation' },
    { ...candidate, field: 'audience' },
    { ...candidate, value: 'crm.write' },
    { ...candidate, tool: 'crm.write' }
  ]) assert.equal(verifyFieldRouteResponse(req, altered).accepted, false);
  assert.equal(verifyFieldRouteResponse({ ...req }, candidate).accepted, false);
});

test('R09 field preparation refuses sensitive data and never invokes caller getters', () => {
  assert.equal(request('objective', 'Meu telefone é +55 85 99999-9999.'), null);
  assert.equal(request('objective', 'Minha senha é SYNTHETIC_SECRET_123.'), null);
  let reads = 0;
  const hostile = { conversationId: 'r09_field_conversation_01', messageId: 'r09_field_message_01',
    userText: 'Quero captar leads.', field: 'objective' };
  Object.defineProperty(hostile, 'userText', { enumerable: true, get() { reads++; return 'Quero captar leads.'; } });
  assert.equal(prepareFieldRouteRequest(hostile), null);
  assert.equal(reads, 0);
});

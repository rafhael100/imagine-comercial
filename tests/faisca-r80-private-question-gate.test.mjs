import test from 'node:test';
import assert from 'node:assert/strict';
import {
  preparePrivateSyntheticQuestion, isTrustedPrivateSyntheticQuestion,
  PRIVATE_SYNTHETIC_QUESTION_SCHEMA
} from '../ops/faisca/openai/private-question-gate.mjs';

const prepare = question => preparePrivateSyntheticQuestion({
  scope: 'local_operator_lab', attestedSynthetic: true, question
});

test('R80 fictional commercial questions map to reviewed candidates without any operational authority', () => {
  for (const question of [
    'Qual a diferença entre um site Onepage e uma Landing Page?',
    'Como funciona a criação de um site Onepage?',
    'O que está incluído em um site Onepage?',
    'Quais são as vantagens de anúncios no Google Ads?'
  ]) {
    const outcome = prepare(question);
    assert.ok(outcome, question);
    assert.equal(outcome.schema, PRIVATE_SYNTHETIC_QUESTION_SCHEMA);
    assert.equal(outcome.question, question);
    assert.ok(outcome.candidateAnswerIds.length > 0);
    assert.equal(Object.isFrozen(outcome), true);
    assert.equal(Object.isFrozen(outcome.candidateAnswerIds), true);
    assert.equal(outcome.customerDataAuthorized, false);
    assert.equal(outcome.publicEnabled, false);
    assert.equal(outcome.operationalEffects, false);
    assert.equal(isTrustedPrivateSyntheticQuestion(outcome), true);
    assert.equal(isTrustedPrivateSyntheticQuestion({ ...outcome }), false);
    assert.ok(!JSON.stringify(outcome).includes('buyerId'));
    assert.ok(!JSON.stringify(outcome).includes('apiKey'));
  }
});

test('R80 refuses operational and personally identifiable questions even if editorial terms occur', () => {
  const sensitive = [
    'Qual o status do meu pedido Onepage?',
    'Preciso da nota fiscal do meu serviço Onepage.',
    'Minha senha para acessar o Portal é ABC987.',
    'Meu telefone é 85 99999-1234 e quero Landing Page.',
    'Meu email é user@example.invalid, quero um site Onepage.',
    'Quero cancelar meu contrato e fazer um site Onepage.',
    'Tenho um boleto de pagamento e preciso de ajuda com meu site.',
    'O meu cliente enviou o CPF 123.456.789-01 para contratar Onepage.',
    'Envie para https://example.invalid as informações de um site Onepage.',
    'Minha chave de API está pronta para o site Onepage.',
    'Estou com meu site fora do ar e quero suporte.',
    'Qual o PIX para pagar pelo Onepage?'
  ];
  for (const question of sensitive) assert.equal(prepare(question), null, question);
});

test('R80 rejects untrusted scopes, no operator attestation, unknown fields and bad text', () => {
  const good = {
    scope: 'local_operator_lab',
    attestedSynthetic: true,
    question: 'Qual a diferença entre Onepage e Landing Page?'
  };
  for (const raw of [
    { ...good, scope: 'public_customer' },
    { ...good, attestedSynthetic: false },
    { ...good, publicEnabled: true },
    { ...good, customerEmail: 'x@example.invalid' },
    { ...good, question: '' },
    { ...good, question: 'Como vai?' },
    { ...good, question: ' '+good.question },
    { ...good, question: good.question + '\n' },
    { ...good, question: good.question + '\u200B' },
    { ...good, question: 'Qual é o site Onepage? ' + 'x'.repeat(300) },
    { ...good, question: 'Qual é a oferta Onepage?\u202e' },
    null, [], 'Quero Onepage'
  ]) assert.equal(preparePrivateSyntheticQuestion(raw), null);
});

test('R80 hostile getters or Proxy get traps never expose private content', () => {
  let getterCalls = 0, proxyCalls = 0;
  const hostile = { scope: 'local_operator_lab', attestedSynthetic: true };
  Object.defineProperty(hostile, 'question', { enumerable: true, get() {
    getterCalls++;
    throw new Error('private');
  } });
  assert.equal(preparePrivateSyntheticQuestion(hostile), null);
  assert.equal(getterCalls, 0);
  const raw = {
    scope: 'local_operator_lab', attestedSynthetic: true,
    question: 'Qual a diferença entre Onepage e Landing Page?'
  };
  const proxy = new Proxy(raw, {
    get(target, name) {
      if (name === 'question') {
        proxyCalls++;
        return 'Minha senha para pagamento é private';
      }
      return Reflect.get(target, name);
    }
  });
  assert.ok(preparePrivateSyntheticQuestion(proxy));
  assert.equal(proxyCalls, 0);
});

test('R80 unknown or irrelevant prose does not reach even a simulated model selector', () => {
  for (const question of [
    'Como será a previsão do tempo amanhã?',
    'Quem é o presidente do país?',
    'Quero acessar uma conta bancária desconhecida',
    'Quero receber documentos sensíveis de um cliente'
  ]) assert.equal(prepare(question), null, question);
});

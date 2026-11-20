import test from 'node:test';
import assert from 'node:assert/strict';
import { readPrivateSyntheticQuestion, preparePrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';

const fixture = question => ({ scope: 'local_operator_lab', attestedSynthetic: true, question });

test('R96: never admit un-attested or extra-field operator input', () => {
  const validShape = fixture('Como funciona uma landing page ficticia?');
  assert.equal(readPrivateSyntheticQuestion({ ...validShape, attestedSynthetic: false }), null);
  assert.equal(readPrivateSyntheticQuestion({ ...validShape, scope: 'public' }), null);
  assert.equal(readPrivateSyntheticQuestion({ ...validShape, customerId: 'synthetic' }), null);
  assert.equal(readPrivateSyntheticQuestion(Object.assign(Object.create({ question: 'inherited' }), validShape)), null);
});

test('R96: reject operator text with credentials, personal identifiers and control characters', () => {
  for (const question of [
    'Como funciona uma landing page? token abc123',
    'Como funciona uma landing page? cpf 12345678901',
    'Como funciona uma landing page? contato teste@example.com',
    'Como funciona uma landing page? https://example.org',
    'Como funciona uma landing page?\u202Eexemplo',
    'Como funciona uma landing page?\u200Bexemplo',
    'Como funciona uma landing page?\nexemplo',
    'Como funciona uma landing page? pix pagamento'
  ]) {
    assert.equal(readPrivateSyntheticQuestion(fixture(question)), null, 'must reject unsafe synthetic input');
    assert.equal(preparePrivateSyntheticQuestion(fixture(question)), null);
  }
});

test('R96: reject noncanonical Unicode, overlong UTF-8 and invalid input types', () => {
  assert.equal(readPrivateSyntheticQuestion(fixture('Como funciona uma pa\u0301gina ficticia?')), null);
  assert.equal(readPrivateSyntheticQuestion(fixture('Como funciona ' + 'á'.repeat(300) + ' uma pagina?')), null);
  assert.equal(readPrivateSyntheticQuestion(fixture(123)), null);
  assert.equal(readPrivateSyntheticQuestion(fixture('Como funciona uma pagina ficticia? ')), null);
});

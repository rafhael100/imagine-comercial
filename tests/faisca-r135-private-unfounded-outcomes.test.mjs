import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPrivateUnsupportedOutcomeGuarantee, safePrivateGeneralReply } from '../ops/faisca/openai/private-conversation-policy.mjs';
const unsafe = [
  'Uma landing page garante novas vendas para o negócio.',
  'Uma campanha assegura clientes e resultados comerciais.',
  'Resultados garantidos com um site institucional.',
  'O SEO promete primeira posição no Google.'
];
test('R135 fabricated marketing outcome promises are rejected', () => {
  for (const reply of unsafe) {
    assert.equal(hasPrivateUnsupportedOutcomeGuarantee(reply), true, reply);
    assert.equal(safePrivateGeneralReply(reply), false, reply);
  }
});
test('R135 normal fictional guidance remains possible', () => {
  const reply = 'Uma landing page pode explicar um evento e ajudar pessoas a encontrar informações úteis.';
  assert.equal(hasPrivateUnsupportedOutcomeGuarantee(reply), false);
  assert.equal(safePrivateGeneralReply(reply), true);
});

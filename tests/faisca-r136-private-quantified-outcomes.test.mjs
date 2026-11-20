import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPrivateUnsupportedOutcomeGuarantee,
  safePrivateGeneralReply
} from '../ops/faisca/openai/private-conversation-policy.mjs';

const unsafe = [
  'Garantimos vendas para qualquer campanha.',
  'A página garantirá primeira posição no buscador.',
  'Prometemos resultados de SEO.',
  'Uma campanha vai gerar 120 leads.',
  'Você terá 50 novos clientes.',
  'Vamos entregar 80 conversões.',
  'O site irá trazer mais de 70 vendas.',
  'Um anúncio vai gerar no mínimo 35 leads.'
];

test('R136: false assurances and numerical forecasts are rejected before private egress', () => {
  for (const claim of unsafe) {
    assert.equal(hasPrivateUnsupportedOutcomeGuarantee(claim), true, claim);
    assert.equal(safePrivateGeneralReply(claim), false, claim);
  }
});

test('R136: neutral advice remains usable without invented outcomes', () => {
  for (const reply of [
    'Uma landing page pode apresentar informações gerais sobre um evento fictício.',
    'Um site institucional pode organizar informações sobre produtos e serviços.',
    'Anúncios podem ajudar pessoas a descobrir uma marca, sem resultados assegurados.'
  ]) {
    assert.equal(hasPrivateUnsupportedOutcomeGuarantee(reply), false, reply);
    assert.equal(safePrivateGeneralReply(reply), true, reply);
  }
});

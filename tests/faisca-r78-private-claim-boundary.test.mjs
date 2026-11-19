import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'R78_PRIVATE_CLAIMS_SYNTHETIC_TOKEN_1234567';
const sourceId = 'faisca.passage.onepage.description@r06-1';

test('R78 private HTTP rejects obvious fabricated commercial claims without echo or actions', async t => {
  let currentText = '', calls = 0;
  const lab = {
    answer: async () => ({
      status: 'draft_answer',
      text: (calls++, currentText),
      sourceIds: [sourceId], modelIds: ['gpt-6-luna', 'gpt-6.1-terra']
    }),
    inspect: () => ({ calls, durableBillingLimit: false })
  };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  async function post() {
    return fetch(server.address + server.path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: '{"caseId":"compare"}'
    });
  }
  const blocked = [
    'Para contratar, acesse https://checkout.example.invalid/now',
    'Para contratar, acesse www.example.invalid/checkout',
    'Escreva agora para comercial@example.invalid e confirme a contratação.',
    'O site Onepage custa R$ 199 no mês de teste privado.',
    'Seu pedido foi confirmado, a produção já pode começar.',
    'O pagamento aprovado já liberou sua solicitação.',
    'Seu ticket criado já está em acompanhamento.',
    'O contrato assinado autoriza os próximos passos.',
    'O lead enviado ao CRM já entrou no funil.'
  ];
  for (const message of blocked) {
    currentText = message;
    const response = await post();
    assert.equal(response.status, 503, message);
    const data = await response.json();
    assert.equal(data.status, 'unavailable');
    assert.doesNotMatch(JSON.stringify(data), /checkout\.example|comercial@example|R\$ 199|CRM/);
  }
  assert.equal(calls, blocked.length, 'Only one synthetic provider call per request, with no retries.');

  currentText = 'O Faísca não criou pedido, cobrança, contrato ou conta nesta prévia.';
  const allowed = await post();
  assert.equal(allowed.status, 200, 'Explicit denial of real operations remains usable.');
  const body = await allowed.json();
  assert.equal(body.publicReady, false);
  assert.equal(body.operationalEffects, false);
  assert.equal(body.requiresEditorialReview, true);
});

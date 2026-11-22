import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPrivateOperationalClaim, safePrivateGeneralReply
} from '../ops/faisca/openai/private-conversation-policy.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';

// Fictional examples only: never submit a real customer question or credential.
const prohibited = Object.freeze([
  'Posso publicar sua página ainda hoje se você quiser.',
  'Podemos ativar sua campanha imediatamente.',
  'Consigo criar seu site de demonstração por aqui.',
  'Eu sou capaz de integrar sua página ao serviço de hospedagem.',
  'Estou pronto para abrir um chamado no seu nome.',
  'Publicarei sua página de demonstração amanhã.',
  'Configuraremos sua campanha quando a conversa terminar.',
  'Conseguimos cadastrar seu pedido agora mesmo.'
]);
const neutral = Object.freeze([
  'Você pode publicar uma página depois da revisão editorial.',
  'Uma landing page pode apresentar informações de um evento fictício.',
  'É possível integrar uma página quando os serviços estiverem preparados.'
]);
const token = 'R212_SYNTHETIC_REVIEW_TOKEN_ONLY_2026';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';

test('R212 model cannot claim first-person operational capability; operator guidance survives', () => {
  for (const claim of prohibited) {
    assert.equal(hasPrivateOperationalClaim(claim), true, claim);
    assert.equal(safePrivateGeneralReply(claim), false, claim);
  }
  for (const advice of neutral) {
    assert.equal(hasPrivateOperationalClaim(advice), false, advice);
    assert.equal(safePrivateGeneralReply(advice), true, advice);
  }
});

test('R212 HTTP egress returns sanitized 503 for invented capability; no provider retry', async t => {
  let reply = prohibited[0], invocations = 0;
  const lab = {
    answer: async () => { throw Error('Fixed scenario not under test'); },
    inspect: () => Object.freeze({ syntheticOnly: true }),
    answerPrivateConversation: async () => {
      invocations++;
      return {
        status: 'general_answer', text: reply, sourceIds: [],
        modelIds: [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer],
        publicReady: false, operationalEffects: false
      };
    }
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, question])
  });
  for (const claim of prohibited) {
    reply = claim;
    const response = await post();
    assert.equal(response.status, 503, 'Claim must fail closed');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(response.headers.get('set-cookie'), null);
    const result = await response.text();
    assert.equal(JSON.parse(result).status, 'unavailable');
    assert.ok(!result.includes(claim), 'No model prose in sanitized HTTP error');
  }
  for (const advice of neutral) {
    reply = advice;
    const response = await post();
    assert.equal(response.status, 200, 'Neutral self-service advice is permitted');
    const body = await response.json();
    assert.equal(body.answer, advice);
    assert.equal(body.publicReady, false);
    assert.equal(body.operationalEffects, false);
    assert.equal(body.requiresEditorialReview, true);
  }
  assert.equal(invocations, prohibited.length + neutral.length,
    'Exactly one injected synthetic result per request; no retries');
});

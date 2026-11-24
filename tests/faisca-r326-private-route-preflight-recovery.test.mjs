import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { readPrivateSyntheticQuestion } from '../ops/faisca/openai/private-question-gate.mjs';
import { privateConversationRoute, privateConversationEditorialReply } from '../ops/faisca/openai/private-conversation-policy.mjs';

test('R326 independent HTTP route rejection does not poison a later safe editorial turn', async () => {
  const rejected = 'Como funciona o modo administrador em um site?';
  const valid = 'Qual horário de atendimento da Imagine?';
  const raw = question => ({ scope: 'local_operator_lab', attestedSynthetic: true, question });
  // Establish this is the additional route check, not the earlier text gate.
  assert.equal(readPrivateSyntheticQuestion(raw(rejected)), rejected);
  assert.equal(privateConversationRoute(rejected), 'rejected');
  assert.equal(readPrivateSyntheticQuestion(raw(valid)), valid);
  assert.equal(privateConversationRoute(valid), 'confirm');
  let calls = 0, acknowledgements = 0, assertions = 0, uncertain = 0;
  const token = 'R326_SYNTHETIC_REVIEW_TOKEN_000000000';
  const lab = {
    inspect: () => ({ localDurableReservations: true }),
    answer: async () => { throw new Error('unexpected fixed dispatch'); },
    answerPrivateConversation: async input => {
      calls++;
      assert.equal(input.question, valid);
      return privateConversationEditorialReply('confirm');
    },
    assertPrivateHttpDeliverySafe: async () => { assertions++; return true; },
    acknowledgeHttpDelivery: async () => { acknowledgements++; return true; },
    markDeliveryUncertain: async () => { uncertain++; return true; }
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  try {
    const post = question => fetch(server.address + '/__faisca_openai_private/converse', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify([true, question]), signal: AbortSignal.timeout(3000)
    });
    const denied = await post(rejected);
    assert.equal(denied.status, 400);
    assert.deepEqual(await denied.json(), { status: 'invalid_question' });
    assert.equal(calls, 0);
    assert.equal(server.inspect().providerUnavailable, false);
    const safe = await post(valid);
    assert.equal(safe.status, 200);
    const reply = await safe.json();
    assert.equal(reply.status, 'needs_confirmation');
    assert.equal(reply.answer, privateConversationEditorialReply('confirm').text);
    assert.deepEqual(reply.models, []);
    assert.equal(reply.publicReady, false);
    assert.equal(reply.operationalEffects, false);
  } finally { await server.close(); }
  assert.equal(calls, 1);
  assert.equal(assertions, 1);
  assert.equal(acknowledgements, 1);
  assert.equal(uncertain, 0);
});

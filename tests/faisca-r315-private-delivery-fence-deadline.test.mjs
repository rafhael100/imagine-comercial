import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const bearer = 'R315_SYNTHETIC_REVIEW_TOKEN_000000000';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const safeReply = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
async function fixture(t, assertion) {
  const counts = { provider: 0, ack: 0, uncertain: 0 };
  const lab = {
    inspect: () => ({ localDurableReservations: true }),
    answer: async () => { throw Error('unexpected fixed case'); },
    answerPrivateConversation: async () => {
      counts.provider++;
      return { status: 'general_answer', text: safeReply, sourceIds: [],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra'] };
    },
    assertPrivateHttpDeliverySafe: assertion,
    acknowledgeHttpDelivery: async () => { counts.ack++; return true; },
    markDeliveryUncertain: async () => { counts.uncertain++; return true; }
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: bearer, enablePrivateConversation: true,
    providerDeadlineMs: 1000, deliveryAckDeadlineMs: 80
  });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', headers: { Authorization: 'Bearer ' + bearer,
      'Content-Type': 'application/json' },
    body: JSON.stringify([true, question]), signal: AbortSignal.timeout(2000)
  });
  return { counts, server, post };
}

test('R315 stalled final durable assertion fails closed without a second provider dispatch', async t => {
  let affirm;
  const pending = new Promise(resolve => { affirm = resolve; });
  const { counts, server, post } = await fixture(t, () => pending);
  const first = await post();
  assert.equal(first.status, 503);
  assert.equal((await first.json()).status, 'unavailable');
  assert.equal(server.inspect().providerUnavailable, true);
  affirm(true);
  const second = await post();
  assert.equal(second.status, 503);
  await second.json();
  await server.close();
  assert.deepEqual(counts, { provider: 1, ack: 0, uncertain: 1 });
});

test('R315 positive final durable assertion still permits private delivery and acknowledgement', async t => {
  const { counts, server, post } = await fixture(t, async () => true);
  const response = await post();
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.answer, safeReply);
  assert.equal(json.publicReady, false);
  assert.equal(json.operationalEffects, false);
  await server.close();
  assert.deepEqual(counts, { provider: 1, ack: 1, uncertain: 0 });
});

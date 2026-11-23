import assert from 'node:assert/strict';
import { createFaiscaLocalReservationLedger } from '../../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../../ops/faisca/openai/private-review-http.mjs';

// R282 subprocess, stopped with SIGKILL between HTTP 'finish' and durable ACK.
// All provider traffic is injected local fixture data; no real API or secrets.
const directory = process.argv[2];
const token = 'R282_SYNTHETIC_WORKER_OPERATOR_TOKEN_123456';
const key = 'sk-r282-fake-provider-fixture-not-real-123456';

function mockResponse(model) {
  const payload = model === FAISCA_OPENAI_MODELS.classification
    ? { topic: 'general' }
    : { reply: 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.' };
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(payload) }] }],
    usage: { input_tokens: 200, output_tokens: 35 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function run() {
  let calls = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, enablePrivateConversation: true,
    extendedPrivateSession: true, maxRequests: 4, maxBudgetUsd: 1,
    reservationLedger: createFaiscaLocalReservationLedger({
      directory, maxRequests: 4, maxBudgetUsd: 1
    }),
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.method, 'POST');
      const body = JSON.parse(init.body);
      assert.equal(body.store, false);
      assert.deepEqual(body.tools, []);
      calls++;
      assert.ok(calls <= 2);
      return mockResponse(body.model);
    }
  });
  const wrapper = {
    inspect: () => lab.inspect(),
    answer: (...args) => lab.answer(...args),
    answerPrivateConversation: (...args) => lab.answerPrivateConversation(...args),
    assertPrivateHttpDeliverySafe: (...args) => lab.assertPrivateHttpDeliverySafe(...args),
    acknowledgeHttpDelivery() {
      process.send?.({ type: 'ack-inflight' });
      // Crash before this unbounded synthetic callback releases the
      // durable marker. Parent kills process immediately after HTTP 200.
      return new Promise(() => {});
    },
    markDeliveryUncertain: (...args) => lab.markDeliveryUncertain(...args)
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab: wrapper, reviewToken: token, enablePrivateConversation: true,
    port: 0, deliveryAckDeadlineMs: 30000
  });
  process.send?.({ type: 'listening', address: server.address });
}

run().catch(() => {
  process.send?.({ type: 'worker-error' });
  process.exitCode = 1;
});

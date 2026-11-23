import assert from 'node:assert/strict';
import { createFaiscaLocalReservationLedger } from '../../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../../ops/faisca/openai/private-review-http.mjs';

// R285: separate OS process; delayed local HTTP acknowledgement, not a delayed
// provider call. IPC transports only event names and a loopback address.
const directory = process.argv[2];
const token = 'R285_SYNTHETIC_WORKER_TOKEN_123456789';
const key = 'sk-r285-fixture-only-not-a-real-provider-key-123456';
const answer = 'Uma landing page pode apresentar a programacao e orientar o publico sobre o evento.';
const ledger = createFaiscaLocalReservationLedger({
  directory, maxRequests: 4, maxBudgetUsd: 1
});
let releaseAck;
const ackGate = new Promise(resolve => { releaseAck = resolve; });
let closing = false;

function reply(model) {
  const payload = model === FAISCA_OPENAI_MODELS.classification
    ? { topic: 'general' } : { reply: answer };
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
    enabled: true, apiKey: key,
    enablePrivateConversation: true, extendedPrivateSession: true,
    maxRequests: 4, maxBudgetUsd: 1, reservationLedger: ledger,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.method, 'POST');
      const request = JSON.parse(init.body);
      assert.equal(request.store, false);
      assert.deepEqual(request.tools, []);
      calls++;
      assert.ok(calls <= 2, 'Only the first synthetic private turn may dispatch.');
      return reply(request.model);
    }
  });
  const wrapper = {
    inspect: () => lab.inspect(),
    answer: (...args) => lab.answer(...args),
    answerPrivateConversation: (...args) => lab.answerPrivateConversation(...args),
    assertPrivateHttpDeliverySafe: (...args) => lab.assertPrivateHttpDeliverySafe(...args),
    async acknowledgeHttpDelivery(...args) {
      assert.equal(calls, 2);
      process.send?.({ type: 'ack-pending' });
      await ackGate;
      return lab.acknowledgeHttpDelivery(...args);
    },
    markDeliveryUncertain: (...args) => lab.markDeliveryUncertain(...args)
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab: wrapper, reviewToken: token, enablePrivateConversation: true,
    port: 0, deliveryAckDeadlineMs: 1800
  });
  process.on('message', async message => {
    if (message?.type === 'release') releaseAck();
    if (message?.type === 'shutdown' && !closing) {
      closing = true;
      releaseAck();
      try { await server.close(); process.exit(0); }
      catch { process.exit(1); }
    }
  });
  process.send?.({ type: 'listening', address: server.address });
}

run().catch(() => {
  process.send?.({ type: 'worker-error' });
  process.exit(1);
});

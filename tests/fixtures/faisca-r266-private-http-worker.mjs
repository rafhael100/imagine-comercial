import assert from 'node:assert/strict';
import { createFaiscaLocalReservationLedger } from '../../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../../ops/faisca/openai/private-review-http.mjs';

// Spawned by the R266 test as a genuinely separate OS process. It cannot
// access real OpenAI credentials, services or user messages.
const directory = process.argv[2];
// R268: opt-in second-call barrier; prior R266/R267 tests keep first-call mode.
const holdAt = process.argv[3] === 'second' ? 2 : 1;
const reviewToken = 'R266_SYNTHETIC_WORKER_TOKEN_123456789';
const fixtureKey = 'sk-r266-fixture-only-not-real-credential-1234567';
const ledger = createFaiscaLocalReservationLedger({
  directory, maxRequests: 4, maxBudgetUsd: 1
});
let releaseHeld;
const holdProvider = new Promise(resolve => { releaseHeld = resolve; });
let calls = 0;
let closing = false;

function mockResponse(model) {
  const response = model === FAISCA_OPENAI_MODELS.classification
    ? { topic: 'general' }
    : { reply: 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.' };
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(response) }] }],
    usage: { input_tokens: 200, output_tokens: 35 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function run() {
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: fixtureKey,
    enablePrivateConversation: true, extendedPrivateSession: true,
    maxRequests: 4, maxBudgetUsd: 1, reservationLedger: ledger,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.method, 'POST');
      const request = JSON.parse(init.body);
      assert.equal(request.store, false);
      assert.deepEqual(request.tools, []);
      calls++;
      if (calls === holdAt) {
        process.send?.({ type: holdAt === 1 ? 'first-provider-entered' : 'second-provider-entered' });
        await holdProvider;
      }
      return mockResponse(request.model);
    }
  });
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken, enablePrivateConversation: true, port: 0
  });
  process.on('message', async message => {
    if (message?.type === 'release') releaseHeld();
    if (message?.type === 'shutdown' && !closing) {
      closing = true;
      releaseHeld();
      try { await server.close(); process.exit(0); }
      catch { process.exit(1); }
    }
  });
  process.send?.({ type: 'listening', address: server.address });
}
run().catch(() => {
  // Never send exception text or credentials through IPC.
  process.send?.({ type: 'worker-error' });
  process.exit(1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// Synthetic local responses only. No provider network, credential, VPS, CRM or Portal.
const token = 'R272_SYNTHETIC_OPERATOR_TOKEN_123456789';
const key = 'sk-r272-fixture-not-real-123456789';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const endpoint = '/__faisca_openai_private/converse';

function reply(model) {
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

function post(base, authorization = token) {
  return fetch(base + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: 'Bearer ' + authorization } : {})
    },
    body: JSON.stringify([true, question])
  });
}

for (const decision of ['true', 'false', 'undefined', 'null']) {
  test('R272 private paid HTTP requires explicit true from final durable fence: ' + decision,
    { timeout: 15000 }, async () => {
      const directory = await mkdtemp(join(tmpdir(), 'faisca-r272-'));
      await chmod(directory, 0o700);
      let server;
      try {
        const ledger = createFaiscaLocalReservationLedger({
          directory, maxRequests: 4, maxBudgetUsd: 1
        });
        let providerCalls = 0, fenceCalls = 0;
        const original = createFaiscaOpenAILiveLab({
          enabled: true, apiKey: key, enablePrivateConversation: true,
          extendedPrivateSession: true, maxRequests: 4, maxBudgetUsd: 1,
          reservationLedger: ledger,
          fetchImpl: async (url, init) => {
            assert.equal(url, 'https://api.openai.com/v1/responses');
            assert.equal(init.method, 'POST');
            assert.equal(JSON.parse(init.body).store, false);
            providerCalls++;
            return reply(JSON.parse(init.body).model);
          }
        });
        const lab = Object.freeze({
          answer: (...args) => original.answer(...args),
          answerPrivateConversation: (...args) => original.answerPrivateConversation(...args),
          inspect: () => original.inspect(),
          acknowledgeHttpDelivery: () => original.acknowledgeHttpDelivery(),
          markDeliveryUncertain: () => original.markDeliveryUncertain(),
          async assertPrivateHttpDeliverySafe() {
            fenceCalls++;
            if (decision === 'true') return original.assertPrivateHttpDeliverySafe();
            if (decision === 'false') return false;
            if (decision === 'null') return null;
            return undefined;
          }
        });
        server = await startFaiscaOpenAIPrivateReview({
          lab, reviewToken: token, enablePrivateConversation: true, port: 0
        });
        assert.equal((await post(server.address, null)).status, 403);
        const response = await post(server.address);
        assert.equal(response.status, decision === 'true' ? 200 : 503);
        assert.equal(response.headers.get('access-control-allow-origin'), null);
        assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
        const output = await response.json();
        if (decision === 'true') {
          assert.equal(output.status, 'general_answer');
          assert.equal(output.publicReady, false);
          assert.equal(output.operationalEffects, false);
        } else {
          assert.equal(output.status, 'unavailable');
          assert.equal((await post(server.address)).status, 503);
          assert.doesNotMatch(JSON.stringify(output), /R272_SYNTHETIC|sk-r272|landing page|ledger|marker|directory/i);
        }
        assert.equal(providerCalls, 2, 'A rejected fence must never retry either model');
        assert.equal(fenceCalls, 1, 'Decision is checked at the last HTTP boundary');
        await server.close();
        server = null;
        const state = await ledger.inspectReadOnly();
        assert.equal(state.requests, 2, 'Paid reservations are never refunded by HTTP safety failures');
        const files = await readdir(directory);
        assert.equal(files.includes('.faisca-provider-outcome-uncertain'), decision !== 'true');
        assert.equal(files.includes('.faisca-provider-dispatch-inflight'), decision !== 'true');
        for (const file of files) {
          const stored = await readFile(join(directory, file), 'utf8');
          for (const prohibited of [token, key, question]) {
            assert.equal(stored.includes(prohibited), false);
          }
        }
      } finally {
        await server?.close();
        await rm(directory, { recursive: true, force: true });
      }
    });
}

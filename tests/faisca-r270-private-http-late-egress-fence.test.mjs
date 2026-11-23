import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// No network to the real provider. All texts, tokens, requests and costs are fictional.
const token = 'R270_FAKE_PRIVATE_OPERATOR_TOKEN_123456789';
const key = 'sk-r270-fixture-not-a-real-key-123456789';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const endpoint = '/__faisca_openai_private/converse';

function post(base, bearer = token) {
  return fetch(base + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: 'Bearer ' + bearer } : {})
    },
    body: JSON.stringify([true, question])
  });
}

function fakeOpenAIResponse(model) {
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

for (const peerFencesAfterEditorialCheck of [false, true]) {
  test('R270 rechecks paid dispatch immediately before HTTP egress: ' +
    (peerFencesAfterEditorialCheck ? 'late peer fence' : 'clean finish'),
    { timeout: 15000 }, async () => {
      const directory = await mkdtemp(join(tmpdir(), 'faisca-r270-'));
      await chmod(directory, 0o700);
      const options = { directory, maxRequests: 4, maxBudgetUsd: 1 };
      const localLedger = createFaiscaLocalReservationLedger(options);
      const peerLedger = createFaiscaLocalReservationLedger(options);
      let server;
      try {
        let providerCalls = 0;
        const originalLab = createFaiscaOpenAILiveLab({
          enabled: true, apiKey: key, enablePrivateConversation: true,
          extendedPrivateSession: true, maxRequests: 4, maxBudgetUsd: 1,
          reservationLedger: localLedger,
          fetchImpl: async (url, init) => {
            assert.equal(url, 'https://api.openai.com/v1/responses');
            assert.equal(init.method, 'POST');
            assert.equal(JSON.parse(init.body).store, false);
            providerCalls++;
            return fakeOpenAIResponse(JSON.parse(init.body).model);
          }
        });
        let preSendChecks = 0;
        const lab = Object.freeze({
          answer: (...args) => originalLab.answer(...args),
          answerPrivateConversation: (...args) => originalLab.answerPrivateConversation(...args),
          inspect: () => originalLab.inspect(),
          markDeliveryUncertain: () => originalLab.markDeliveryUncertain(),
          acknowledgeHttpDelivery: () => originalLab.acknowledgeHttpDelivery(),
          async assertPrivateHttpDeliverySafe() {
            preSendChecks++;
            // Inject a distinct ledger object's durable NO-START AFTER Luna
            // and Terra have both returned and the HTTP editorial guard has
            // accepted the answer, not during the provider invocation.
            if (peerFencesAfterEditorialCheck) {
              assert.equal(providerCalls, 2);
              await peerLedger.markOutcomeUncertain();
            }
            return originalLab.assertPrivateHttpDeliverySafe();
          }
        });
        server = await startFaiscaOpenAIPrivateReview({
          lab, reviewToken: token, enablePrivateConversation: true, port: 0
        });
        assert.equal((await post(server.address, null)).status, 403);
        const response = await post(server.address);
        assert.equal(response.status, peerFencesAfterEditorialCheck ? 503 : 200);
        assert.equal(response.headers.get('access-control-allow-origin'), null);
        assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
        const json = await response.json();
        if (peerFencesAfterEditorialCheck) {
          assert.equal(json.status, 'unavailable');
          assert.doesNotMatch(JSON.stringify(json), /sk-r270|R270_FAKE|landing page|ledger|directory|marker/i);
        } else {
          assert.equal(json.status, 'general_answer');
          assert.equal(json.publicReady, false);
          assert.equal(json.operationalEffects, false);
        }
        assert.equal(providerCalls, 2, 'A late fence must never retry the provider');
        assert.equal(preSendChecks, 1, 'The private HTTP guard checks after provider completion');
        await server.close();
        server = null;
        const state = await localLedger.inspectReadOnly();
        assert.equal(state.requests, 2);
        assert.equal(state.publicReady, false);
        const names = await readdir(directory);
        assert.equal(names.includes('.faisca-provider-outcome-uncertain'),
          peerFencesAfterEditorialCheck);
        assert.equal(names.includes('.faisca-provider-dispatch-inflight'),
          peerFencesAfterEditorialCheck);
        if (peerFencesAfterEditorialCheck) {
          await assert.rejects(peerLedger.ready(), /operator|reconcil|uncertain/i);
        } else {
          assert.equal(await peerLedger.ready(), true);
        }
        for (const name of names) {
          const data = await readFile(join(directory, name), 'utf8');
          for (const forbidden of [token, key, question]) {
            assert.equal(data.includes(forbidden), false);
          }
        }
      } finally {
        await server?.close();
        await rm(directory, { recursive: true, force: true });
      }
    });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// R277: the actual R95 /converse HTTP path and R82 ledger are used. OpenAI
// transport is synthetic; no real key, network call, client data or Portal.
const token = 'R277_PRIVATE_SYNTHETIC_OPERATOR_TOKEN_1234';
const key = 'sk-r277-test-fixture-not-usable-key-123456';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const answer = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
const endpoint = '/__faisca_openai_private/converse';

function responseFor(model) {
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{
      type: 'message', role: 'assistant',
      content: [{
        type: 'output_text',
        text: JSON.stringify(model === FAISCA_OPENAI_MODELS.classification
          ? { topic: 'general' } : { reply: answer })
      }]
    }],
    usage: { input_tokens: 200, output_tokens: 35 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function post(address, text, bearer = token) {
  return fetch(address + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: 'Bearer ' + bearer } : {})
    },
    body: JSON.stringify([true, text]),
    redirect: 'error'
  });
}

test('R277 R95 conversation preserves both paid reservations when final fence is tampered during await', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r277-'));
  await chmod(directory, 0o700);
  let server;
  try {
    const config = { directory, maxRequests: 2, maxBudgetUsd: 1 };
    const ledger = createFaiscaLocalReservationLedger(config);
    const modelsSeen = [];
    const liveLab = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: key,
      enablePrivateConversation: true, extendedPrivateSession: true,
      maxRequests: 2, maxBudgetUsd: 1, reservationLedger: ledger,
      fetchImpl: async (url, init) => {
        assert.equal(url, 'https://api.openai.com/v1/responses');
        assert.equal(init.method, 'POST');
        const payload = JSON.parse(init.body);
        assert.equal(payload.store, false);
        assert.deepEqual(payload.tools, []);
        modelsSeen.push(payload.model);
        return responseFor(payload.model);
      }
    });
    let hijacked = 0, finalFences = 0;
    const wrapper = {
      answer: (...args) => liveLab.answer(...args),
      answerPrivateConversation: (...args) => liveLab.answerPrivateConversation(...args),
      inspect: () => liveLab.inspect(),
      async assertPrivateHttpDeliverySafe() {
        finalFences++;
        const result = await liveLab.assertPrivateHttpDeliverySafe();
        // The R275 pre-await hook identity check is now stale. The R276
        // post-await check must prevent HTTP 200 even though this returns true.
        await Promise.resolve();
        wrapper.acknowledgeHttpDelivery = async () => { hijacked++; return true; };
        return result;
      },
      acknowledgeHttpDelivery: (...args) => liveLab.acknowledgeHttpDelivery(...args),
      markDeliveryUncertain: (...args) => liveLab.markDeliveryUncertain(...args)
    };
    server = await startFaiscaOpenAIPrivateReview({
      lab: wrapper, reviewToken: token, enablePrivateConversation: true, port: 0
    });
    assert.equal((await post(server.address, question, null)).status, 403);
    assert.equal(modelsSeen.length, 0);
    assert.equal((await post(server.address,
      'Meu e-mail é pessoa@example.invalid e quero uma campanha.')).status, 400);
    assert.equal(modelsSeen.length, 0);
    const response = await post(server.address, question);
    assert.equal(response.status, 503, 'Late tampering must never yield a successful HTTP reply');
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    const text = await response.text();
    assert.equal(JSON.parse(text).status, 'unavailable');
    assert.doesNotMatch(text, /R277_PRIVATE|sk-|landing page|marker|ledger/i);
    assert.deepEqual(modelsSeen, [
      FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
    ]);
    assert.equal(finalFences, 1);
    assert.equal(hijacked, 0);
    assert.equal(server.inspect().providerUnavailable, true);
    assert.equal((await post(server.address, question)).status, 503);
    assert.equal(modelsSeen.length, 2, 'A second request must not replay Luna/Terra');
    await server.close();

    const persisted = await createFaiscaLocalReservationLedger(config).inspectReadOnly();
    assert.equal(persisted.requests, 2, 'Neither reserved request may be refunded');
    assert.ok(persisted.reservedMicros > 0);
    assert.equal(persisted.providerUsageReconciled, false);
    const filenames = await readdir(directory);
    assert.ok(filenames.includes('.faisca-provider-outcome-uncertain'));
    assert.ok(filenames.includes('.faisca-provider-dispatch-inflight'));
    await assert.rejects(
      createFaiscaLocalReservationLedger(config).ready(), /uncertain|review/i
    );
    for (const filename of filenames) {
      const value = await readFile(join(directory, filename), 'utf8');
      for (const forbidden of [question, answer, token, key, 'pessoa@example.invalid']) {
        assert.equal(value.includes(forbidden), false,
          'No prompt, answer or simulated credential may be persisted in the ledger');
      }
    }
  } finally {
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

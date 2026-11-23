import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// R279: actual R95 HTTP + R82 fsynced ledger with an intentionally broken
// ACK adapter; provider transport is synthetic and never reaches OpenAI.
const token = 'R279_PRIVATE_SYNTHETIC_OPERATOR_TOKEN_1234567';
const key = 'sk-r279-synthetic-fixture-not-real-key-123456';
const endpoint = '/__faisca_openai_private/converse';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const answer = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';

function replyFor(model) {
  const parsed = model === FAISCA_OPENAI_MODELS.classification
    ? { topic: 'general' } : { reply: answer };
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{
      type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(parsed) }]
    }],
    usage: { input_tokens: 200, output_tokens: 35 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function post(base, text, bearer = token) {
  return fetch(base + endpoint, {
    method: 'POST', redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: 'Bearer ' + bearer } : {})
    },
    body: JSON.stringify([true, text])
  });
}

test('R279 failed durable ACK persists NO-START and prevents replay across process restarts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r279-'));
  await chmod(directory, 0o700);
  const ledgerConfig = { directory, maxRequests: 4, maxBudgetUsd: 1 };
  const ledger = () => createFaiscaLocalReservationLedger(ledgerConfig);
  const models = [];
  let ackCalls = 0, markerCalls = 0, server;
  try {
    const lab = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: key, enablePrivateConversation: true,
      extendedPrivateSession: true, maxRequests: 4, maxBudgetUsd: 1,
      reservationLedger: ledger(),
      fetchImpl: async (url, init) => {
        assert.equal(url, 'https://api.openai.com/v1/responses');
        assert.equal(init.method, 'POST');
        const payload = JSON.parse(init.body);
        assert.equal(payload.store, false);
        assert.deepEqual(payload.tools, []);
        models.push(payload.model);
        return replyFor(payload.model);
      }
    });
    const wrapper = {
      answer: (...args) => lab.answer(...args),
      answerPrivateConversation: (...args) => lab.answerPrivateConversation(...args),
      inspect: () => lab.inspect(),
      assertPrivateHttpDeliverySafe: (...args) => lab.assertPrivateHttpDeliverySafe(...args),
      // Transport completed, but injected adapter refuses to affirm that the
      // durable dispatch marker was successfully released.
      async acknowledgeHttpDelivery() {
        ackCalls++;
        return false;
      },
      async markDeliveryUncertain(...args) {
        markerCalls++;
        return lab.markDeliveryUncertain(...args);
      }
    };
    server = await startFaiscaOpenAIPrivateReview({
      lab: wrapper, reviewToken: token, enablePrivateConversation: true, port: 0
    });
    assert.equal((await post(server.address, question, null)).status, 403);
    assert.equal((await post(server.address,
      'Meu e-mail fictício é pessoa@example.invalid')).status, 400);
    assert.equal(models.length, 0);

    const first = await post(server.address, question);
    assert.equal(first.status, 200);
    const output = await first.json();
    assert.equal(output.status, 'general_answer');
    assert.equal(output.answer, answer);
    assert.equal(output.publicReady, false);
    assert.equal(output.operationalEffects, false);

    const second = await post(server.address, question);
    assert.equal(second.status, 503);
    assert.equal(second.headers.get('access-control-allow-origin'), null);
    assert.equal(second.headers.get('cache-control'), 'no-store, max-age=0');
    const errorBody = await second.text();
    assert.equal(JSON.parse(errorBody).status, 'unavailable');
    assert.doesNotMatch(errorBody, /sk-|R279_PRIVATE|landing page|ledger|marker/i);
    assert.deepEqual(models, [
      FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
    ]);
    assert.equal(server.inspect().providerUnavailable, true);
    await server.close();
    assert.equal(ackCalls, 1);
    assert.equal(markerCalls, 1);

    const persisted = await ledger().inspectReadOnly();
    assert.equal(persisted.requests, 2,
      'Both model calls remain reserved, without refund or automatic retry');
    assert.ok(persisted.reservedMicros > 0);
    assert.equal(persisted.providerUsageReconciled, false);
    const filenames = await readdir(directory);
    assert.ok(filenames.includes('.faisca-provider-outcome-uncertain'));
    assert.ok(filenames.includes('.faisca-provider-dispatch-inflight'));
    await assert.rejects(ledger().ready(), /uncertain|review/i);
    for (const filename of filenames) {
      const value = await readFile(join(directory, filename), 'utf8');
      for (const forbidden of [
        question, answer, token, key, 'pessoa@example.invalid'
      ]) {
        assert.equal(value.includes(forbidden), false,
          'No fictional transcript or key may be persisted');
      }
    }

    let restartedCalls = 0;
    const restarted = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: key, enablePrivateConversation: true,
      extendedPrivateSession: true, maxRequests: 4, maxBudgetUsd: 1,
      reservationLedger: ledger(),
      fetchImpl: async () => { restartedCalls++; throw new Error('Unexpected replay'); }
    });
    const next = await startFaiscaOpenAIPrivateReview({
      lab: restarted, reviewToken: token, enablePrivateConversation: true, port: 0
    });
    try {
      const denied = await post(next.address, question);
      assert.equal(denied.status, 503);
      assert.equal((await denied.json()).status, 'unavailable');
      assert.equal(restartedCalls, 0);
    } finally {
      await next.close();
    }
    assert.equal((await ledger().inspectReadOnly()).requests, 2);
  } finally {
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// R281: R95 HTTP + R82 fsynced ledger, with deliberately stalled HTTP ACK.
// Provider calls and credentials are synthetic; no external network or operations.
const token = 'R281_PRIVATE_SYNTHETIC_OPERATOR_TOKEN_1234567';
const key = 'sk-r281-synthetic-not-real-key-123456';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const answer = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
const endpoint = '/__faisca_openai_private/converse';

function responseFor(model) {
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

function post(origin, body = question, authorized = true) {
  return fetch(origin + endpoint, {
    method: 'POST', redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      ...(authorized ? { Authorization: 'Bearer ' + token } : {})
    },
    body: JSON.stringify([true, body])
  });
}

for (const ackMode of ['never', 'late']) {
  test('R281 ' + ackMode + ' ACK timeout persists NO-START and survives listener restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'faisca-r281-'));
    await chmod(directory, 0o700);
    const config = { directory, maxRequests: 4, maxBudgetUsd: 1 };
    const ledger = () => createFaiscaLocalReservationLedger(config);
    const models = [];
    let ackCount = 0, uncertaintyCount = 0, lateResolve, server;
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
          return responseFor(payload.model);
        }
      });
      const wrapper = {
        inspect: () => lab.inspect(),
        answer: (...args) => lab.answer(...args),
        answerPrivateConversation: (...args) => lab.answerPrivateConversation(...args),
        assertPrivateHttpDeliverySafe: (...args) => lab.assertPrivateHttpDeliverySafe(...args),
        acknowledgeHttpDelivery() {
          ackCount++;
          if (ackMode === 'never') return new Promise(() => {});
          return new Promise(resolve => { lateResolve = resolve; });
        },
        async markDeliveryUncertain(...args) {
          uncertaintyCount++;
          return lab.markDeliveryUncertain(...args);
        }
      };
      server = await startFaiscaOpenAIPrivateReview({
        lab: wrapper, reviewToken: token, enablePrivateConversation: true,
        port: 0, deliveryAckDeadlineMs: 80
      });
      assert.equal((await post(server.address, question, false)).status, 403);
      assert.equal((await post(server.address, 'Meu contato fictício é teste@example.invalid')).status, 400);
      assert.equal(models.length, 0);

      const first = await post(server.address);
      assert.equal(first.status, 200);
      const firstBody = await first.json();
      assert.equal(firstBody.status, 'general_answer');
      assert.equal(firstBody.answer, answer);
      assert.equal(firstBody.publicReady, false);
      assert.equal(firstBody.operationalEffects, false);

      // The next request waits on the pending post-write ACK. R280 bounds that
      // wait; the uncertain marker MUST be durable before another dispatch.
      const denied = await post(server.address);
      assert.equal(denied.status, 503);
      assert.equal(denied.headers.get('cache-control'), 'no-store, max-age=0');
      assert.equal(denied.headers.get('access-control-allow-origin'), null);
      const denialText = await denied.text();
      assert.equal(JSON.parse(denialText).status, 'unavailable');
      assert.doesNotMatch(denialText, /sk-|R281_PRIVATE|landing page|ledger|marker/i);
      assert.deepEqual(models, [
        FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
      ]);
      assert.equal(server.inspect().providerUnavailable, true);
      // A late positive ACK must not undo the timeout or release the fence.
      lateResolve?.(true);
      assert.equal((await post(server.address)).status, 503);
      await server.close();
      server = null;
      assert.equal(ackCount, 1);
      assert.equal(uncertaintyCount, 1);

      const snapshot = await ledger().inspectReadOnly();
      assert.equal(snapshot.requests, 2);
      assert.ok(snapshot.reservedMicros > 0);
      assert.equal(snapshot.providerUsageReconciled, false);
      const files = await readdir(directory);
      assert.ok(files.includes('.faisca-provider-outcome-uncertain'));
      assert.ok(files.includes('.faisca-provider-dispatch-inflight'));
      await assert.rejects(ledger().ready(), /uncertain|review/i);
      for (const file of files) {
        const bytes = await readFile(join(directory, file), 'utf8');
        for (const secret of [question, answer, token, key, 'teste@example.invalid']) {
          assert.equal(bytes.includes(secret), false, 'Private ledger cannot store transcript or credentials');
        }
      }

      let replayCalls = 0;
      const freshLab = createFaiscaOpenAILiveLab({
        enabled: true, apiKey: key, enablePrivateConversation: true,
        extendedPrivateSession: true, maxRequests: 4, maxBudgetUsd: 1,
        reservationLedger: ledger(),
        fetchImpl: async () => { replayCalls++; throw new Error('Unexpected paid retry'); }
      });
      const restarted = await startFaiscaOpenAIPrivateReview({
        lab: freshLab, reviewToken: token, enablePrivateConversation: true, port: 0
      });
      try {
        const reply = await post(restarted.address);
        assert.equal(reply.status, 503);
        assert.equal((await reply.json()).status, 'unavailable');
        assert.equal(replayCalls, 0);
      } finally { await restarted.close(); }
      assert.equal((await ledger().inspectReadOnly()).requests, 2);
    } finally {
      lateResolve?.(true);
      await server?.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// R284: a delayed but successful post-finish ACK must serialize the next
// private paid turn. All requests, responses and provider calls are synthetic.
const token = 'R284_PRIVATE_SYNTHETIC_OPERATOR_TOKEN_1234567';
const key = 'sk-r284-fake-fixture-not-a-provider-secret-123456';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const answer = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
const endpoint = '/__faisca_openai_private/converse';

function providerReply(model) {
  const result = model === FAISCA_OPENAI_MODELS.classification
    ? { topic: 'general' } : { reply: answer };
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(result) }] }],
    usage: { input_tokens: 200, output_tokens: 35 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
function post(address) {
  return fetch(address + endpoint, {
    method: 'POST', redirect: 'error',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify([true, question])
  });
}

test('R284 a second HTTP turn cannot dispatch while prior durable ACK is delayed, but resumes after confirmation',
  { timeout: 20000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r284-'));
  await chmod(directory, 0o700);
  const config = { directory, maxRequests: 4, maxBudgetUsd: 1 };
  const ledger = () => createFaiscaLocalReservationLedger(config);
  const dispatched = [];
  let signalAckStart, releaseAck;
  const ackStarted = new Promise(resolve => { signalAckStart = resolve; });
  const gate = new Promise(resolve => { releaseAck = resolve; });
  let ackCalls = 0, server;
  try {
    const lab = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: key, enablePrivateConversation: true,
      extendedPrivateSession: true, maxRequests: 4, maxBudgetUsd: 1,
      reservationLedger: ledger(),
      fetchImpl: async (url, init) => {
        assert.equal(url, 'https://api.openai.com/v1/responses');
        assert.equal(init.method, 'POST');
        const request = JSON.parse(init.body);
        assert.equal(request.store, false);
        assert.deepEqual(request.tools, []);
        dispatched.push(request.model);
        assert.ok(dispatched.length <= 4);
        return providerReply(request.model);
      }
    });
    const delayedAckLab = {
      inspect: () => lab.inspect(),
      answer: (...args) => lab.answer(...args),
      answerPrivateConversation: (...args) => lab.answerPrivateConversation(...args),
      assertPrivateHttpDeliverySafe: (...args) => lab.assertPrivateHttpDeliverySafe(...args),
      async acknowledgeHttpDelivery(...args) {
        ackCalls++;
        if (ackCalls === 1) {
          signalAckStart();
          await gate;
        }
        return lab.acknowledgeHttpDelivery(...args);
      },
      markDeliveryUncertain: (...args) => lab.markDeliveryUncertain(...args)
    };
    server = await startFaiscaOpenAIPrivateReview({
      lab: delayedAckLab, reviewToken: token,
      enablePrivateConversation: true, port: 0,
      deliveryAckDeadlineMs: 1500
    });
    const first = await post(server.address);
    assert.equal(first.status, 200);
    assert.equal((await first.json()).status, 'general_answer');
    await ackStarted;
    assert.equal((await ledger().inspectReadOnly()).requests, 2);
    assert.ok((await readdir(directory)).includes('.faisca-provider-dispatch-inflight'),
      'the marker must remain while the post-finish ACK is pending');

    let secondSettled = false;
    const secondRequest = post(server.address).then(
      value => { secondSettled = true; return value; },
      error => { secondSettled = true; throw error; }
    );
    await new Promise(resolve => setTimeout(resolve, 35));
    assert.equal(secondSettled, false,
      'HTTP request must await prior ACK instead of running in parallel');
    assert.deepEqual(dispatched, [
      FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
    ]);
    releaseAck();
    const second = await secondRequest;
    assert.equal(second.status, 200);
    assert.equal((await second.json()).status, 'general_answer');
    await server.close();
    server = null;
    assert.equal(ackCalls, 2);
    assert.deepEqual(dispatched, [
      FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer,
      FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
    ]);
    const observed = await ledger().inspectReadOnly();
    assert.equal(observed.requests, 4);
    assert.equal(observed.providerUsageReconciled, false);
    const files = await readdir(directory);
    assert.ok(!files.includes('.faisca-provider-dispatch-inflight'));
    assert.ok(!files.includes('.faisca-provider-outcome-uncertain'));
    for (const file of files) {
      const disk = await readFile(join(directory, file), 'utf8');
      for (const secret of [question, answer, token, key]) {
        assert.equal(disk.includes(secret), false);
      }
    }
  } finally {
    releaseAck?.();
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

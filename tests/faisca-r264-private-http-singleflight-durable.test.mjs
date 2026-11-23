import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// HTTP end-to-end with a real local durable ledger, not a mocked accounting
// interface. The only provider is an injected offline response fixture.
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const answer = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
const privateToken = 'R264_PRIVATE_LOCAL_SYNTHETIC_TOKEN_123456';
const fixtureKey = 'sk-r264-fixture-not-a-real-credential-123456';
const privatePath = '/__faisca_openai_private/converse';
const invalidText = 'Meu email é pessoa@example.invalid e preciso de um site.';

function fixtureResponse(model) {
  const value = model === FAISCA_OPENAI_MODELS.classification
    ? { topic: 'general' } : { reply: answer };
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{
      type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(value) }]
    }],
    usage: { input_tokens: 200, output_tokens: 35 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function post(address, text = question, token = privateToken) {
  return fetch(address + privatePath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: JSON.stringify([true, text])
  });
}

test('R264 concurrent HTTP submission cannot bypass the durable paid-dispatch fence', { timeout: 12000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r264-'));
  await chmod(directory, 0o700);
  const ledgerOptions = { directory, maxRequests: 2, maxBudgetUsd: 1 };
  const ledger = createFaiscaLocalReservationLedger(ledgerOptions);
  let releaseFirst;
  const heldFirst = new Promise(resolve => { releaseFirst = resolve; });
  let notifyFirst;
  const firstEntered = new Promise(resolve => { notifyFirst = resolve; });
  let calls = 0;
  let server;
  try {
    const lab = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: fixtureKey, enablePrivateConversation: true,
      extendedPrivateSession: true, maxRequests: 2, maxBudgetUsd: 1,
      reservationLedger: ledger,
      fetchImpl: async (url, init) => {
        assert.equal(url, 'https://api.openai.com/v1/responses');
        assert.equal(init.method, 'POST');
        const data = JSON.parse(init.body);
        assert.equal(data.store, false);
        assert.deepEqual(data.tools, []);
        calls++;
        if (calls === 1) {
          notifyFirst();
          await heldFirst;
        }
        return fixtureResponse(data.model);
      }
    });
    server = await startFaiscaOpenAIPrivateReview({
      lab, reviewToken: privateToken, enablePrivateConversation: true, port: 0
    });
    const first = post(server.address);
    await firstEntered;
    assert.equal(calls, 1);
    assert.equal(server.inspect().inFlight, true);

    const competing = await post(server.address);
    assert.equal(competing.status, 429);
    assert.deepEqual(await competing.json(), { status: 'busy' });
    const anonymous = await post(server.address, question, null);
    assert.equal(anonymous.status, 403);
    const rejected = await post(server.address, invalidText);
    assert.equal(rejected.status, 400);
    assert.deepEqual(await rejected.json(), { status: 'invalid_question' });

    assert.equal(calls, 1,
      'Parallel, anonymous and personal-data requests must not enter the paid provider');
    assert.equal((await ledger.inspectReadOnly()).requests, 1,
      'Only the admitted first provider call may reserve capacity');

    releaseFirst();
    const good = await first;
    assert.equal(good.status, 200);
    const reply = await good.json();
    assert.equal(reply.status, 'general_answer');
    assert.equal(reply.answer, answer);
    assert.deepEqual(reply.models, [
      FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
    ]);
    assert.equal(reply.publicReady, false);
    assert.equal(reply.operationalEffects, false);
    assert.equal(calls, 2, 'The admitted request uses precisely Luna and Terra');
    await server.close();

    const persisted = await createFaiscaLocalReservationLedger(ledgerOptions).inspectReadOnly();
    assert.equal(persisted.requests, 2);
    assert.equal(persisted.providerUsageReconciled, false);
    assert.equal(persisted.publicReady, false);
    await assert.rejects(
      createFaiscaLocalReservationLedger(ledgerOptions).ready({
        requireCapacity: true, minimumRequests: 1
      }), /limit reached/
    );

    for (const file of await readdir(directory)) {
      const bytes = await readFile(join(directory, file), 'utf8');
      for (const forbidden of [
        question, answer, invalidText, 'pessoa@example.invalid', privateToken, fixtureKey
      ]) {
        assert.equal(bytes.includes(forbidden), false,
          'The durable store must not retain operator text, answers or credentials');
      }
    }
  } finally {
    releaseFirst();
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

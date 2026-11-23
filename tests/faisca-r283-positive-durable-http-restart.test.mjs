import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// R283: the positive counterpart to R279-R282's failure cases.
// No real provider, credentials, customer data, staging mutation or public listener.
const token = 'R283_PRIVATE_SYNTHETIC_OPERATOR_TOKEN_1234567';
const secondToken = 'R283_PRIVATE_SYNTHETIC_SECOND_OPERATOR_1234567';
const key = 'sk-r283-fake-fixture-not-a-provider-secret-123456';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const answer = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
const endpoint = '/__faisca_openai_private/converse';

function providerReply(model) {
  const payload = model === FAISCA_OPENAI_MODELS.classification
    ? { topic: 'general' }
    : { reply: answer };
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(payload) }] }],
    usage: { input_tokens: 200, output_tokens: 35 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function post(address, bearer = token, text = question) {
  return fetch(address + endpoint, {
    method: 'POST', redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: 'Bearer ' + bearer } : {})
    },
    body: JSON.stringify([true, text])
  });
}

test('R283 a confirmed durable ACK permits a second private turn after listener restart without quota reset',
  { timeout: 20000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r283-'));
  await chmod(directory, 0o700);
  const ledgerConfig = { directory, maxRequests: 4, maxBudgetUsd: 1 };
  const ledger = () => createFaiscaLocalReservationLedger(ledgerConfig);
  const models = [];
  let server;
  const createLab = () => createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, enablePrivateConversation: true,
    extendedPrivateSession: true, maxRequests: 4, maxBudgetUsd: 1,
    reservationLedger: ledger(),
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.method, 'POST');
      const request = JSON.parse(init.body);
      assert.equal(request.store, false);
      assert.deepEqual(request.tools, []);
      models.push(request.model);
      assert.ok(models.length <= 4, 'no extra provider invocation');
      return providerReply(request.model);
    }
  });
  try {
    server = await startFaiscaOpenAIPrivateReview({
      lab: createLab(), reviewToken: token,
      enablePrivateConversation: true, port: 0
    });
    assert.match(server.address, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal((await post(server.address, null)).status, 403);
    assert.equal((await post(server.address, token,
      'Meu email fictício é pessoa@example.invalid')).status, 400);
    assert.equal(models.length, 0, 'rejected requests must not use a reservation');
    const first = await post(server.address);
    assert.equal(first.status, 200);
    const firstBody = await first.json();
    assert.equal(firstBody.status, 'general_answer');
    assert.equal(firstBody.answer, answer);
    assert.equal(firstBody.publicReady, false);
    assert.equal(firstBody.operationalEffects, false);
    assert.equal(first.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(first.headers.get('access-control-allow-origin'), null);
    await server.close(); // Wait for the post-finish durable ACK.
    server = null;

    const firstSnapshot = await ledger().inspectReadOnly();
    assert.equal(firstSnapshot.requests, 2);
    assert.ok(firstSnapshot.reservedMicros > 0);
    assert.equal(firstSnapshot.providerUsageReconciled, false);
    const firstFiles = await readdir(directory);
    assert.ok(!firstFiles.includes('.faisca-provider-dispatch-inflight'),
      'successful confirmed delivery must release only its own marker');
    assert.ok(!firstFiles.includes('.faisca-provider-outcome-uncertain'));
    await ledger().ready();

    // New instance, new HTTP listener, same fsynced quota state.
    // Only the two remaining calls are available; the tally must not reset.
    server = await startFaiscaOpenAIPrivateReview({
      lab: createLab(), reviewToken: secondToken,
      enablePrivateConversation: true, port: 0
    });
    assert.equal((await post(server.address, token)).status, 403,
      'the previous ephemeral review token must not authorize the new listener');
    assert.equal(models.length, 2);
    const next = await post(server.address, secondToken);
    assert.equal(next.status, 200);
    const secondBody = await next.json();
    assert.equal(secondBody.status, 'general_answer');
    assert.equal(secondBody.answer, answer);
    assert.equal(secondBody.requiresEditorialReview, true);
    assert.equal(secondBody.publicReady, false);
    assert.equal(secondBody.operationalEffects, false);
    await server.close();
    server = null;
    assert.deepEqual(models, [
      FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer,
      FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
    ]);
    const finalSnapshot = await ledger().inspectReadOnly();
    assert.equal(finalSnapshot.requests, 4);
    assert.ok(finalSnapshot.reservedMicros > firstSnapshot.reservedMicros);
    assert.equal(finalSnapshot.providerUsageReconciled, false,
      'an estimated reservation is not independent OpenAI reconciliation');
    const files = await readdir(directory);
    assert.ok(!files.includes('.faisca-provider-dispatch-inflight'));
    assert.ok(!files.includes('.faisca-provider-outcome-uncertain'));
    for (const file of files) {
      const bytes = await readFile(join(directory, file), 'utf8');
      for (const forbidden of [question, answer, token, secondToken, key,
        'pessoa@example.invalid']) {
        assert.equal(bytes.includes(forbidden), false,
          'durable budget files must not retain private transcript or tokens');
      }
    }
  } finally {
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

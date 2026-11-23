import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// No live keys, real customer messages, Portal, Sites, network or payments.
// The private HTTP server listens on 127.0.0.1 with an injected fake provider.
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const answer = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
const fakeAddress = 'pessoa@example.invalid';
const token = 'R263_SYNTHETIC_LOCAL_OPERATOR_TOKEN_1234';
const key = 'sk-r263-fixture-not-a-real-credential-123456';
const path = '/__faisca_openai_private/converse';

function responseFor(model) {
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

async function withLedger(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r263-'));
  await chmod(directory, 0o700);
  try { return await fn(directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

function newLedger(directory) {
  return createFaiscaLocalReservationLedger({
    directory, maxRequests: 2, maxBudgetUsd: 1
  });
}

function newLab(ledger, fetchImpl) {
  return createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key,
    enablePrivateConversation: true, extendedPrivateSession: true,
    maxRequests: 2, maxBudgetUsd: 1,
    reservationLedger: ledger, fetchImpl
  });
}

function post(origin, text, bearer = token) {
  return fetch(origin + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: 'Bearer ' + bearer } : {})
    },
    body: JSON.stringify([true, text])
  });
}

async function verifyDiskPrivacy(directory) {
  const entries = await readdir(directory);
  const expected = new Set([
    '.faisca-reservations-initialized',
    '.faisca-reservations-highwater-initialized',
    '.faisca-reservations-highwater.json',
    'faisca-reservations.json'
  ]);
  assert.deepEqual(new Set(entries), expected,
    'Success must not leave a dispatch/uncertainty marker or transcript');
  for (const name of entries) {
    const disk = await readFile(join(directory, name), 'utf8');
    for (const forbidden of [question, answer, fakeAddress, token, key]) {
      assert.equal(disk.includes(forbidden), false,
        'Durable reservation files must not persist conversation or credentials');
    }
  }
}

test('R263 private HTTP honors durable reservations and never saves synthetic messages', async () => {
  await withLedger(async directory => {
    let transportCalls = 0;
    const ledger = newLedger(directory);
    const lab = newLab(ledger, async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.method, 'POST');
      const payload = JSON.parse(init.body);
      assert.equal(payload.store, false);
      assert.deepEqual(payload.tools, []);
      transportCalls++;
      return responseFor(payload.model);
    });
    const server = await startFaiscaOpenAIPrivateReview({
      lab, reviewToken: token, enablePrivateConversation: true, port: 0
    });
    try {
      assert.equal((await post(server.address, question, null)).status, 403);
      assert.equal((await post(server.address,
        'Meu email é ' + fakeAddress + ' e preciso de um site.')).status, 400);
      const editorial = await post(server.address,
        'Quanto a Imagine cobra por uma landing page?');
      assert.equal(editorial.status, 200);
      assert.equal((await editorial.json()).status, 'editorial_answer');
      assert.equal(transportCalls, 0);
      assert.equal((await ledger.inspectReadOnly()).requests, 0,
        'No unauthenticated, personal or editorial input may reserve spend');

      const positive = await post(server.address, question);
      assert.equal(positive.status, 200);
      const outcome = await positive.json();
      assert.equal(outcome.status, 'general_answer');
      assert.equal(outcome.answer, answer);
      assert.deepEqual(outcome.models, [
        FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
      ]);
      assert.equal(outcome.publicReady, false);
      assert.equal(outcome.operationalEffects, false);
      assert.equal(transportCalls, 2);
      await server.close(); // Wait for the HTTP-finish durable dispatch acknowledgement.

      const persisted = await newLedger(directory).inspectReadOnly();
      assert.equal(persisted.requests, 2);
      assert.ok(persisted.reservedMicros > 0);
      assert.equal(persisted.providerUsageReconciled, false);
      assert.equal(persisted.publicReady, false);
      await verifyDiskPrivacy(directory);

      // A different worker cannot reset the spent allowance or secretly retry.
      const restartedLedger = newLedger(directory);
      await assert.rejects(
        restartedLedger.ready({ requireCapacity: true, minimumRequests: 1 }),
        /limit reached/
      );
      let retried = 0;
      const restartedLab = newLab(restartedLedger, async () => {
        retried++;
        throw new Error('Unexpected replay');
      });
      await assert.rejects(restartedLab.answerPrivateConversation({
        scope: 'local_operator_lab', attestedSynthetic: true, question
      }), /OpenAI private test unavailable/);
      assert.equal(retried, 0);
      assert.equal((await newLedger(directory).inspectReadOnly()).requests, 2);
    } finally {
      await server.close();
    }
  });
});

test('R263 uncertain HTTP/provider failure persists a NO-START fence across workers', async () => {
  await withLedger(async directory => {
    let calls = 0;
    const ledger = newLedger(directory);
    const lab = newLab(ledger, async () => {
      calls++;
      return new Response('synthetic unavailable', { status: 503 });
    });
    const server = await startFaiscaOpenAIPrivateReview({
      lab, reviewToken: token, enablePrivateConversation: true, port: 0
    });
    try {
      const failed = await post(server.address, question);
      assert.equal(failed.status, 503);
      assert.equal((await failed.json()).status, 'unavailable');
      assert.equal(calls, 1, 'An uncertain paid call must not be retried');
      await server.close();
      const persisted = await newLedger(directory).inspectReadOnly();
      assert.equal(persisted.requests, 1,
        'Failed/uncertain upstream calls never refund a durable reservation');
      await assert.rejects(newLedger(directory).ready(), /uncertain|review/i);
      const files = await readdir(directory);
      assert.ok(files.includes('.faisca-provider-outcome-uncertain'));
      assert.ok(files.includes('.faisca-provider-dispatch-inflight'));
      const state = await readFile(join(directory, 'faisca-reservations.json'), 'utf8');
      for (const forbidden of [question, answer, fakeAddress, token, key]) {
        assert.equal(state.includes(forbidden), false);
      }
    } finally {
      await server.close();
    }
  });
});

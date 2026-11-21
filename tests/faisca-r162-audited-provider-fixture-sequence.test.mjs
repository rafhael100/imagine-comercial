import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import {
  createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS
} from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { inspectFaiscaPrivateConversationSequence } from '../ops/faisca/openai/private-staging-sequence.mjs';

const TOKEN = 'R162_PRIVATE_SYNTHETIC_OPERATOR_BEARER_ONLY';
const KEY = 'sk-r162-fixture-never-real-openai-credential';
const ANSWER = 'Uma landing page pode explicar um projeto de demonstração fictício.';
const URL = 'https://api.openai.com/v1/responses';

function providerResponse(model, output) {
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(output) }] }],
    usage: { input_tokens: 120, output_tokens: 20 }
  }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}

async function fixture(t, { failLuna = false, failTerra = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r162-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ledger = createFaiscaLocalReservationLedger({
    directory, maxRequests: 3, maxBudgetUsd: 1
  });
  const providerCalls = [];
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: KEY, enablePrivateConversation: true,
    extendedPrivateSession: true, maxRequests: 20,
    maxBudgetUsd: 10, reservationLedger: ledger,
    fetchImpl: async (url, init) => {
      assert.equal(url, URL);
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'error');
      const request = JSON.parse(init.body);
      assert.equal(request.store, false);
      assert.deepEqual(request.tools, []);
      assert.equal(request.tool_choice, 'none');
      providerCalls.push(request.model);
      if (request.model === FAISCA_OPENAI_MODELS.classification) {
        return failLuna ? new Response('synthetic provider outage', { status: 503 }) :
          providerResponse(request.model, { topic: 'general' });
      }
      assert.equal(request.model, FAISCA_OPENAI_MODELS.answer);
      return failTerra ? new Response('synthetic provider outage', { status: 503 }) :
        providerResponse(request.model, { reply: ANSWER });
    }
  });
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: TOKEN, enablePrivateConversation: true
  });
  t.after(() => server.close());
  return { ledger, lab, server, providerCalls };
}

function safeResult(result) {
  assert.equal(result.publicReady, false);
  assert.equal(result.operationalEffects, false);
  assert.equal(result.providerTransportVerified, false);
  assert.equal(result.ledgerReconciled, false);
  assert.equal(result.modelCallsProvenZeroForNegative, false);
  assert.equal(result.modelCallsProvenExactlyTwoForPositive, false);
  const json = JSON.stringify(result);
  for (const sensitive of [TOKEN, KEY, ANSWER, URL]) {
    assert.equal(json.includes(sensitive), false);
  }
}

test('R162 real adapter with mocked API: negative sends no model request, audited positive reserves Luna+Terra', async t => {
  const f = await fixture(t);
  let httpPosts = 0;
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: f.server.address, reviewToken: TOKEN, enabled: true,
    inspectLedger: () => f.ledger.inspectReadOnly(),
    fetchImpl: async (url, init) => {
      if (init.method === 'POST') {
        httpPosts++;
        assert.equal(init.headers.Authorization, 'Bearer ' + TOKEN);
        assert.equal(init.credentials, 'omit');
        assert.equal(init.cache, 'no-store');
        if (httpPosts === 2) {
          assert.deepEqual(f.providerCalls, [],
            'negative rejected before any simulated upstream dispatch');
          assert.equal((await f.ledger.inspectReadOnly()).requests, 0);
        }
      }
      return fetch(url, init);
    }
  });
  assert.equal(result.status, 'PRIVATE_SYNTHETIC_SEQUENCE_ENVELOPES_VERIFIED');
  assert.equal(result.localLedgerDeltasVerified, true);
  assert.equal(result.apiRequests, 2);
  assert.equal(httpPosts, 2);
  assert.deepEqual(f.providerCalls, [
    FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
  ]);
  assert.equal(f.lab.inspect().calls, 2);
  const snapshot = await f.ledger.inspectReadOnly();
  assert.equal(snapshot.requests, 2);
  assert.ok(snapshot.reservedMicros > 0);
  safeResult(result);
});

for (const [name, errors, expected] of [
  ['Luna', { failLuna: true }, [FAISCA_OPENAI_MODELS.classification]],
  ['Terra', { failTerra: true }, [
    FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
  ]]
]) {
  test('R162 ' + name + ' simulated HTTP 503 never reports a successful audited answer or retries', async t => {
    const f = await fixture(t, errors);
    const result = await inspectFaiscaPrivateConversationSequence({
      origin: f.server.address, reviewToken: TOKEN, enabled: true,
      inspectLedger: () => f.ledger.inspectReadOnly()
    });
    assert.equal(result.status, 'BLOCKED_POSITIVE_GATE');
    assert.equal(result.negativeInputRejected, true);
    assert.equal(result.positiveEnvelopeAccepted, false);
    assert.equal(result.localLedgerDeltasVerified, false);
    assert.equal(result.apiRequests, 2);
    assert.deepEqual(f.providerCalls, expected);
    const snapshot = await f.ledger.inspectReadOnly();
    assert.equal(snapshot.requests, expected.length,
      'even failed model attempts reserve capacity without retry');
    safeResult(result);
  });
}

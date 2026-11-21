import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import {
  createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS
} from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { inspectFaiscaPrivateConversationSequence } from '../ops/faisca/openai/private-staging-sequence.mjs';

const token = 'R158_PRIVATE_REVIEW_BEARER_SYNTHETIC_ONLY_2026';
const fakeKey = 'sk-r158-local-fixture-not-a-real-provider-secret-2026';
const safeAnswer = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';

async function withPrivateDirectory(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r158-'));
  await chmod(directory, 0o700);
  try { await fn(directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

function modelResponse(model, data) {
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{
      type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(data) }]
    }],
    usage: { input_tokens: 150, output_tokens: 25 }
  }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}

function createFixture(directory, { failTerra = false, failLuna = false } = {}) {
  const apiCalls = [];
  const ledger = createFaiscaLocalReservationLedger({
    directory, maxRequests: 2, maxBudgetUsd: 1
  });
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: fakeKey,
    enablePrivateConversation: true, extendedPrivateSession: true,
    maxRequests: 20, maxBudgetUsd: 10, reservationLedger: ledger,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.method, 'POST');
      const request = JSON.parse(init.body);
      assert.equal(request.store, false);
      assert.deepEqual(request.tools, []);
      assert.equal(request.tool_choice, 'none');
      assert.equal(init.redirect, 'error');
      apiCalls.push(request.model);
      if (request.model === FAISCA_OPENAI_MODELS.classification) {
        return failLuna ? new Response('unavailable', { status: 503 }) :
          modelResponse(request.model, { topic: 'general' });
      }
      assert.equal(request.model, FAISCA_OPENAI_MODELS.answer);
      return failTerra ? new Response('unavailable', { status: 503 }) :
        modelResponse(request.model, { reply: safeAnswer });
    }
  });
  return { ledger, lab, apiCalls };
}

async function inspectLedger(directory, expectedRequests) {
  const state = JSON.parse(await readFile(join(directory, 'faisca-reservations.json'), 'utf8'));
  const highwater = JSON.parse(await readFile(join(directory, '.faisca-reservations-highwater.json'), 'utf8'));
  assert.equal(state.requests, expectedRequests);
  assert.equal(highwater.requests, expectedRequests);
  assert.equal(state.reservedMicros, highwater.reservedMicros);
  assert.equal(state.limitMicros, highwater.limitMicros);
  assert.equal(state.limitRequests, 2);
  assert.ok(state.reservedMicros > 0);
  return state;
}

test('R158 actual private HTTP sequence: negative spends zero, Luna/Terra reserve exactly twice, witness matches', async t => {
  await withPrivateDirectory(async directory => {
    const fixture = createFixture(directory);
    const server = await startFaiscaOpenAIPrivateReview({
      lab: fixture.lab, reviewToken: token, enablePrivateConversation: true
    });
    t.after(() => server.close());
    let gets = 0, posts = 0;
    const fetchImpl = async (url, init) => {
      if (init.method === 'GET') {
        gets++;
        if (gets === 5) {
          // Beginning of positive asset validation, after the negative POST.
          assert.equal(fixture.apiCalls.length, 0);
          await assert.rejects(
            readFile(join(directory, 'faisca-reservations.json')),
            { code: 'ENOENT' }
          );
        }
      } else if (init.method === 'POST') {
        posts++;
        assert.equal(init.headers.Authorization, 'Bearer ' + token);
        assert.equal(init.redirect, 'error');
        assert.equal(init.credentials, 'omit');
        assert.equal(init.cache, 'no-store');
      }
      return fetch(url, init);
    };
    const result = await inspectFaiscaPrivateConversationSequence({
      origin: server.address, reviewToken: token, enabled: true, fetchImpl
    });
    assert.equal(result.status, 'PRIVATE_SYNTHETIC_SEQUENCE_ENVELOPES_VERIFIED');
    assert.equal(result.assetRequests, 8);
    assert.equal(result.apiRequests, 2);
    assert.equal(result.negativeInputRejected, true);
    assert.equal(result.positiveEnvelopeAccepted, true);
    assert.equal(result.ledgerReconciled, false,
      'live staging ledger comparison is still an operator gate');
    assert.equal(gets, 8);
    assert.equal(posts, 2);
    assert.deepEqual(fixture.apiCalls, ['gpt-6-luna', 'gpt-6.1-terra']);
    assert.equal(fixture.lab.inspect().calls, 2);
    await inspectLedger(directory, 2);
    await assert.rejects(fixture.ledger.reserve(0.01), /limit reached/);
    assert.equal(fixture.apiCalls.length, 2, 'no duplicate or delayed provider dispatch');
    assert.equal(JSON.stringify(result).includes(fakeKey), false);
    assert.equal(JSON.stringify(result).includes(token), false);
    assert.equal(JSON.stringify(result).includes(safeAnswer), false);
  });
});

for (const [name, failure, expectedCalls] of [
  ['Luna', { failLuna: true }, ['gpt-6-luna']],
  ['Terra', { failTerra: true }, ['gpt-6-luna', 'gpt-6.1-terra']]
]) {
  test('R158 ' + name + ' synthetic provider failure keeps every durable reservation without retry', async t => {
    await withPrivateDirectory(async directory => {
      const fixture = createFixture(directory, failure);
      const server = await startFaiscaOpenAIPrivateReview({
        lab: fixture.lab, reviewToken: token, enablePrivateConversation: true
      });
      t.after(() => server.close());
      const result = await inspectFaiscaPrivateConversationSequence({
        origin: server.address, reviewToken: token, enabled: true
      });
      assert.equal(result.status, 'BLOCKED_POSITIVE_GATE');
      assert.equal(result.negativeInputRejected, true);
      assert.equal(result.positiveEnvelopeAccepted, false);
      assert.equal(result.apiRequests, 2, 'only one negative and one positive POST');
      assert.deepEqual(fixture.apiCalls, expectedCalls);
      await inspectLedger(directory, expectedCalls.length);
      assert.equal(result.publicReady, false);
      assert.equal(result.providerTransportVerified, false);
    });
  });
}

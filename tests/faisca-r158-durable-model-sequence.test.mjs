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

async function withPrivateReview(options, fn) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r158-'));
  let server;
  try {
    await chmod(directory, 0o700);
    const fixture = createFixture(directory, options);
    server = await startFaiscaOpenAIPrivateReview({
      lab: fixture.lab, reviewToken: token, enablePrivateConversation: true
    });
    await fn(directory, fixture, server);
  } finally {
    // HTTP finish precedes the asynchronous durable ACK/fence. Drain before
    // removing the directory; t.after runs too late for this fixture scope.
    try { await server?.close(); }
    finally { await rm(directory, { recursive: true, force: true }); }
  }
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

test('R158 actual private HTTP sequence: negative spends zero, Luna/Terra reserve exactly twice, witness matches', async () => {
  await withPrivateReview({}, async (directory, fixture, server) => {
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
    await server.close();
    await inspectLedger(directory, 2);
    assert.equal(await fixture.ledger.ready(), true, 'durable ACK drained before independent readiness check');
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
  test('R158 ' + name + ' synthetic provider failure keeps every durable reservation without retry', async () => {
    await withPrivateReview(failure, async (directory, fixture, server) => {
      const result = await inspectFaiscaPrivateConversationSequence({
        origin: server.address, reviewToken: token, enabled: true
      });
      assert.equal(result.status, 'BLOCKED_POSITIVE_GATE');
      assert.equal(result.negativeInputRejected, true);
      assert.equal(result.positiveEnvelopeAccepted, false);
      assert.equal(result.apiRequests, 2, 'only one negative and one positive POST');
      assert.deepEqual(fixture.apiCalls, expectedCalls);
      await server.close();
      await inspectLedger(directory, expectedCalls.length);
      assert.equal(result.publicReady, false);
      assert.equal(result.providerTransportVerified, false);
    });
  });
}

test('R338 staging operator reconciles independent read-only ledger across the real HTTP sequence', async () => {
  for (const [failure, expectedCalls] of [
    [{}, ['gpt-6-luna', 'gpt-6.1-terra']],
    [{ failLuna: true }, ['gpt-6-luna']],
    [{ failTerra: true }, ['gpt-6-luna', 'gpt-6.1-terra']]
  ]) {
    await withPrivateReview(failure, async (directory, fixture, server) => {
      // Same independent read-only adapter as the operator CLI, not a
      // fabricated sequence snapshot and never the provider's credentials.
      const observer = createFaiscaLocalReservationLedger({
        directory, maxRequests: 2, maxBudgetUsd: 1
      });
      const observations = [];
      const result = await inspectFaiscaPrivateConversationSequence({
        origin: server.address, reviewToken: token, enabled: true,
        inspectReadiness: () => observer.ready(),
        inspectLedger: async () => {
          const snapshot = await observer.inspectReadOnly();
          observations.push(snapshot.requests);
          return snapshot;
        }
      });
      await server.close();
      assert.deepEqual(observations, [0, 0, expectedCalls.length]);
      assert.deepEqual(fixture.apiCalls, expectedCalls);
      await inspectLedger(directory, expectedCalls.length);
      if (failure.failLuna || failure.failTerra) {
        assert.equal(result.status, 'BLOCKED_POSITIVE_GATE');
        assert.equal(result.failedPositiveReservedRequests, expectedCalls.length);
        assert.equal(result.localLedgerDeltasVerified, false);
        await assert.rejects(observer.ready(), {
          message: 'Private provider outcome uncertain; operator reconciliation required.'
        });
        await assert.rejects(observer.reserve(0.01), {
          message: 'Private provider outcome uncertain; operator reconciliation required.'
        });
        assert.deepEqual(fixture.apiCalls, expectedCalls, 'no new dispatch after refusal');
      } else {
        assert.equal(result.status, 'PRIVATE_SYNTHETIC_SEQUENCE_ENVELOPES_VERIFIED');
        assert.equal(result.localLedgerDeltasVerified, true);
        assert.equal(result.failedPositiveReservedRequests, null);
        assert.equal(await observer.ready(), true);
      }
      assert.equal(result.ledgerReconciled, false);
      assert.equal(result.providerTransportVerified, false);
      assert.equal(result.publicReady, false);
      assert.equal(result.operationalEffects, false);
    });
  }
});

test('R340 staging with only one durable request left never sends positive HTTP or dispatches Luna', async () => {
  await withPrivateReview({}, async (directory, fixture, server) => {
    // Model a previously reserved call, without making any provider request.
    await fixture.ledger.reserve(0.01);
    const observer = createFaiscaLocalReservationLedger({
      directory, maxRequests: 2, maxBudgetUsd: 1
    });
    const before = await observer.inspectReadOnly();
    assert.equal(before.requests, 1);
    const observations = [];
    let posts = 0;
    const result = await inspectFaiscaPrivateConversationSequence({
      origin: server.address, reviewToken: token, enabled: true,
      fetchImpl: async (url, init) => {
        if (init.method === 'POST') posts++;
        return fetch(url, init);
      },
      inspectLedger: async () => {
        const snapshot = await observer.inspectReadOnly();
        observations.push(snapshot);
        return snapshot;
      }
    });
    await server.close();
    assert.equal(result.status, 'BLOCKED_LEDGER_CAPACITY');
    assert.equal(result.negativeInputRejected, true);
    assert.equal(result.positiveEnvelopeAccepted, false);
    assert.equal(result.apiRequests, 1);
    assert.equal(result.assetRequests, 4);
    assert.equal(posts, 1, 'only privacy-negative POST allowed');
    assert.deepEqual(fixture.apiCalls, []);
    assert.deepEqual(observations, [before, before]);
    assert.deepEqual(await observer.inspectReadOnly(), before);
    await inspectLedger(directory, 1);
    assert.equal(result.localLedgerDeltasVerified, false);
    assert.equal(result.ledgerReconciled, false);
    assert.equal(result.providerTransportVerified, false);
    assert.equal(result.publicReady, false);
    assert.equal(result.operationalEffects, false);
  });
});

for (const timing of ['before', 'after-negative']) {
  test('R341 operator refuses fenced dispatch ' + timing + ' even with unchanged ledger counters', async () => {
    await withPrivateReview({}, async (directory, fixture, server) => {
      const observer = createFaiscaLocalReservationLedger({
        directory, maxRequests: 2, maxBudgetUsd: 1
      });
      const before = await observer.inspectReadOnly();
      assert.equal(before.requests, 0);
      if (timing === 'before') await fixture.ledger.markOutcomeUncertain();
      let reads = 0, gets = 0, posts = 0;
      const result = await inspectFaiscaPrivateConversationSequence({
        origin: server.address, reviewToken: token, enabled: true,
        inspectLedger: async () => {
          const snapshot = await observer.inspectReadOnly();
          if (++reads === 2 && timing === 'after-negative') {
            await fixture.ledger.markOutcomeUncertain();
          }
          return snapshot;
        },
        inspectReadiness: () => observer.ready(),
        fetchImpl: async (url, init) => {
          if (init.method === 'POST') posts++;
          if (init.method === 'GET') gets++;
          return fetch(url, init);
        }
      });
      assert.equal(result.status, 'BLOCKED_LEDGER_GATE');
      assert.equal(result.negativeInputRejected, timing === 'after-negative');
      assert.equal(result.positiveEnvelopeAccepted, false);
      assert.equal(posts, timing === 'before' ? 0 : 1);
      assert.equal(gets, timing === 'before' ? 0 : 4);
      assert.equal(result.apiRequests, posts);
      assert.equal(result.assetRequests, gets);
      assert.deepEqual(fixture.apiCalls, []);
      assert.deepEqual(await observer.inspectReadOnly(), before);
      assert.equal(result.localLedgerDeltasVerified, false);
      assert.equal(result.ledgerReconciled, false);
      assert.equal(result.providerTransportVerified, false);
      assert.equal(result.publicReady, false);
      assert.equal(result.operationalEffects, false);
      await assert.rejects(observer.ready(), /outcome uncertain/);
    });
  });
}

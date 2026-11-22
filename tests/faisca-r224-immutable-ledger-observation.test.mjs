import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  captureFaiscaLocalLedgerSnapshot, matchFaiscaLocalLedgerDelta
} from '../ops/faisca/openai/private-ledger-sequence-proof.mjs';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { inspectFaiscaPrivateConversationSequence } from '../ops/faisca/openai/private-staging-sequence.mjs';

const TOKEN = 'R224_SYNTHETIC_OPERATOR_TOKEN_NO_REAL_CREDENTIAL';

function sample() {
  return {
    schema: 'faisca.private-ledger-readonly-snapshot.v1',
    atomicAcrossProcesses: false, limitMicros: 1_000_000,
    limitRequests: 4, operationalEffects: false,
    providerUsageReconciled: false, publicReady: false,
    requests: 0, reservedMicros: 0
  };
}

test('R224 copies historical counters and never compares a mutable alias', () => {
  const reused = sample();
  const before = captureFaiscaLocalLedgerSnapshot(reused);
  assert.equal(Object.isFrozen(before), true);
  reused.requests = 1;
  reused.reservedMicros = 10_000;
  const after = captureFaiscaLocalLedgerSnapshot(reused);
  assert.deepEqual([before.requests, before.reservedMicros], [0, 0]);
  assert.deepEqual([after.requests, after.reservedMicros], [1, 10_000]);
  assert.equal(matchFaiscaLocalLedgerDelta(before, after, 0), false);
  assert.equal(matchFaiscaLocalLedgerDelta(before, after, 2), false);
});

test('R224 rejects accessor, symbol and malformed ledger evidence before a comparison', () => {
  const accessor = sample();
  Object.defineProperty(accessor, 'requests', {
    enumerable: true, get() { throw Error('synthetic getter must not execute'); }
  });
  assert.equal(captureFaiscaLocalLedgerSnapshot(accessor), null);
  const symbolKey = sample();
  symbolKey[Symbol('covert-counter')] = 42;
  assert.equal(captureFaiscaLocalLedgerSnapshot(symbolKey), null);
  assert.equal(captureFaiscaLocalLedgerSnapshot({ ...sample(), requests: -1 }), null);
  assert.equal(captureFaiscaLocalLedgerSnapshot(sample())?.requests, 0);
});

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r224-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ledger = createFaiscaLocalReservationLedger({
    directory, maxRequests: 4, maxBudgetUsd: 1
  });
  let modelCalls = 0, apiPosts = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    reviewToken: TOKEN, enablePrivateConversation: true,
    lab: {
      answer: async () => { modelCalls++; throw Error('unexpected model call'); },
      answerPrivateConversation: async () => {
        modelCalls++; throw Error('unexpected model call');
      },
      inspect: () => ({ syntheticOnly: true })
    }
  });
  t.after(() => server.close());
  const fetchImpl = (url, init) => {
    if (init.method === 'POST') {
      apiPosts++;
      return Promise.resolve(new Response('{}', {
        status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }));
    }
    return fetch(url, init);
  };
  return { server, ledger, fetchImpl,
    apiPosts: () => apiPosts, modelCalls: () => modelCalls };
}

test('R224 negative forged HTTP 200 cannot hide a reservation in a reused inspector object', async t => {
  const f = await fixture(t);
  const shared = await f.ledger.inspectReadOnly();
  let inspections = 0;
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: f.server.address, reviewToken: TOKEN, enabled: true,
    fetchImpl: f.fetchImpl,
    inspectLedger: async () => {
      inspections++;
      if (inspections === 2) {
        await f.ledger.reserve(0.01);
        Object.assign(shared, await f.ledger.inspectReadOnly());
      }
      return shared; // Intentionally the SAME object on both invocations.
    }
  });
  assert.equal(result.status, 'BLOCKED_LEDGER_GATE');
  assert.equal(inspections, 2);
  assert.equal(f.apiPosts(), 1, 'positive conversation must not be dispatched');
  assert.equal(f.modelCalls(), 0);
  assert.equal((await f.ledger.inspectReadOnly()).requests, 1);
  assert.equal(result.publicReady, false);
  assert.equal(result.localLedgerDeltasVerified, false);
  assert.equal(result.providerTransportVerified, false);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});

test('R224 stable reused ledger still returns negative gate without positive dispatch', async t => {
  const f = await fixture(t);
  const shared = await f.ledger.inspectReadOnly();
  let inspections = 0;
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: f.server.address, reviewToken: TOKEN, enabled: true,
    fetchImpl: f.fetchImpl,
    inspectLedger: async () => { inspections++; return shared; }
  });
  assert.equal(result.status, 'BLOCKED_NEGATIVE_GATE');
  assert.equal(inspections, 2);
  assert.equal(f.apiPosts(), 1);
  assert.equal(f.modelCalls(), 0);
  assert.equal(result.publicReady, false);
});

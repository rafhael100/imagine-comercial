import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  hasFaiscaLocalTwoModelHeadroom
} from '../ops/faisca/openai/private-ledger-sequence-proof.mjs';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { inspectFaiscaPrivateConversationSequence } from '../ops/faisca/openai/private-staging-sequence.mjs';

function snapshot(requests = 0, reservedMicros = 0) {
  return {
    schema: 'faisca.private-ledger-readonly-snapshot.v1',
    requests, reservedMicros, limitRequests: 3, limitMicros: 1_000_000,
    atomicAcrossProcesses: false, providerUsageReconciled: false,
    publicReady: false, operationalEffects: false
  };
}

test('R164 headroom requires two durable attempts and two micros; never asserts provider funds', () => {
  assert.equal(hasFaiscaLocalTwoModelHeadroom(snapshot()), true);
  assert.equal(hasFaiscaLocalTwoModelHeadroom(snapshot(1, 1000)), true);
  assert.equal(hasFaiscaLocalTwoModelHeadroom(snapshot(2, 1000)), false);
  assert.equal(hasFaiscaLocalTwoModelHeadroom(snapshot(3, 1000)), false);
  assert.equal(hasFaiscaLocalTwoModelHeadroom(snapshot(0, 999999)), false);
  assert.equal(hasFaiscaLocalTwoModelHeadroom(snapshot(0, 999998)), true);
  assert.equal(hasFaiscaLocalTwoModelHeadroom({ ...snapshot(), publicReady: true }), false);
  assert.equal(hasFaiscaLocalTwoModelHeadroom(null), false);
});

test('R164 private HTTP staging: exhausted ledger lets negative privacy check finish but blocks positive POST', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r164-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ledger = createFaiscaLocalReservationLedger({
    directory, maxRequests: 3, maxBudgetUsd: 1
  });
  await ledger.reserve(0.01);
  await ledger.reserve(0.02);
  let attemptedPositive = 0;
  const lab = {
    answer: async () => { throw Error('never call this synthetic path'); },
    answerPrivateConversation: async () => {
      attemptedPositive++;
      throw Error('headroom gate should prevent all attempts');
    },
    inspect: () => ({ syntheticOnly: true })
  };
  const token = 'R164_PRIVATE_SYNTHETIC_ONLY_NO_REAL_BEARER';
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  let posts = 0;
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: server.address, reviewToken: token, enabled: true,
    inspectLedger: () => ledger.inspectReadOnly(),
    fetchImpl: async (url, init) => {
      if (init?.method === 'POST') posts++;
      return fetch(url, init);
    }
  });
  assert.equal(result.status, 'BLOCKED_LEDGER_CAPACITY');
  assert.equal(result.negativeInputRejected, true);
  assert.equal(result.positiveEnvelopeAccepted, false);
  assert.equal(result.apiRequests, 1, 'only the rejected negative POST is permitted');
  assert.equal(posts, 1);
  assert.equal(attemptedPositive, 0);
  assert.equal(result.localLedgerDeltasVerified, false);
  assert.equal(result.ledgerReconciled, false);
  assert.equal(result.providerTransportVerified, false);
  assert.equal(result.publicReady, false);
  assert.equal((await ledger.inspectReadOnly()).requests, 2);
  assert.equal(JSON.stringify(result).includes(token), false);
});

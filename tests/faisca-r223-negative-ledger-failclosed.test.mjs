import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { inspectFaiscaPrivateConversationSequence } from '../ops/faisca/openai/private-staging-sequence.mjs';

const TOKEN = 'R223_SYNTHETIC_PRIVATE_REVIEW_TOKEN_NO_LIVE_KEY';
const NO_SECRET = 'R223_FAKE_PRIVATE_MESSAGE_NEVER_TO_BE_RECORDED';

async function makeFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r223-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ledger = createFaiscaLocalReservationLedger({
    directory, maxRequests: 4, maxBudgetUsd: 1
  });
  let models = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    reviewToken: TOKEN, enablePrivateConversation: true,
    lab: {
      answer: async () => { models++; throw Error('unexpected fixed call'); },
      answerPrivateConversation: async () => {
        models++;
        throw Error('positive must never reach a model');
      },
      inspect: () => ({ syntheticOnly: true })
    }
  });
  t.after(() => server.close());
  let posts = 0;
  const forgedNegative = (url, init) => {
    if (init.method === 'POST') {
      posts++;
      // A syntactically successful but ungrounded negative envelope.
      return Promise.resolve(new Response('{}', {
        status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }));
    }
    return fetch(url, init);
  };
  return { ledger, server, forgedNegative, posts: () => posts, models: () => models };
}

function proveSafe(result, fixture) {
  assert.equal(result.publicReady, false);
  assert.equal(result.operationalEffects, false);
  assert.equal(result.ledgerReconciled, false);
  assert.equal(result.providerTransportVerified, false);
  assert.equal(result.positiveEnvelopeAccepted, false);
  assert.equal(result.localLedgerDeltasVerified, false);
  assert.equal(fixture.posts(), 1, 'only negative POST; never send positive POST');
  assert.equal(fixture.models(), 0, 'no simulated paid model invocation');
  const json = JSON.stringify(result);
  assert.equal(json.includes(TOKEN), false);
  assert.equal(json.includes(NO_SECRET), false);
  assert.equal(json.includes('sk-'), false);
}

test('R223 fails stronger ledger gate if rejected negative HTTP 200 hid a reservation', async t => {
  const f = await makeFixture(t);
  let inspections = 0;
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: f.server.address, reviewToken: TOKEN, enabled: true,
    fetchImpl: f.forgedNegative,
    inspectLedger: async () => {
      inspections++;
      if (inspections === 2) await f.ledger.reserve(0.01);
      return f.ledger.inspectReadOnly();
    }
  });
  assert.equal(result.status, 'BLOCKED_LEDGER_GATE');
  assert.equal(inspections, 2, 'must audit again even when negative probe fails');
  assert.equal((await f.ledger.inspectReadOnly()).requests, 1);
  proveSafe(result, f);
});

test('R223 retains negative gate when failed reply did not change the durable ledger', async t => {
  const f = await makeFixture(t);
  let inspections = 0;
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: f.server.address, reviewToken: TOKEN, enabled: true,
    fetchImpl: f.forgedNegative,
    inspectLedger: async () => {
      inspections++;
      return f.ledger.inspectReadOnly();
    }
  });
  assert.equal(result.status, 'BLOCKED_NEGATIVE_GATE');
  assert.equal(inspections, 2);
  assert.equal((await f.ledger.inspectReadOnly()).requests, 0);
  proveSafe(result, f);
});

test('R223 negative failure and unreadable second snapshot fail closed without leaking errors', async t => {
  const f = await makeFixture(t);
  let inspections = 0;
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: f.server.address, reviewToken: TOKEN, enabled: true,
    fetchImpl: f.forgedNegative,
    inspectLedger: async () => {
      inspections++;
      if (inspections === 2) {
        throw new Error('synthetic secret must not appear: ' + NO_SECRET);
      }
      return f.ledger.inspectReadOnly();
    }
  });
  assert.equal(result.status, 'BLOCKED_LEDGER_GATE');
  assert.equal(inspections, 2);
  proveSafe(result, f);
});

test('R223 negative network failure still audits a changed ledger before returning', async t => {
  const f = await makeFixture(t);
  let inspections = 0, requests = 0;
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: f.server.address, reviewToken: TOKEN, enabled: true,
    fetchImpl: async () => {
      requests++;
      throw new Error('offline fixture network failure');
    },
    inspectLedger: async () => {
      inspections++;
      if (inspections === 2) await f.ledger.reserve(0.01);
      return f.ledger.inspectReadOnly();
    }
  });
  assert.equal(result.status, 'BLOCKED_LEDGER_GATE');
  assert.equal(inspections, 2);
  assert.equal(requests, 1, 'no retries after probe failure');
  assert.equal((await f.ledger.inspectReadOnly()).requests, 1);
  assert.equal(f.posts(), 0);
  assert.equal(f.models(), 0);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
  assert.equal(result.publicReady, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  validFaiscaLocalLedgerSnapshot, matchFaiscaLocalLedgerDelta
} from '../ops/faisca/openai/private-ledger-sequence-proof.mjs';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { inspectFaiscaPrivateConversationSequence } from '../ops/faisca/openai/private-staging-sequence.mjs';

const TOKEN = 'R161_SYNTHETIC_TOKEN_ONLY_NOT_AN_AUTHORIZATION';
const safeAnswer = 'Uma landing page apresenta informacoes gerais de um evento ficticio.';

function snapshot(requests = 0, reservedMicros = 0) {
  return {
    schema: 'faisca.private-ledger-readonly-snapshot.v1',
    requests, reservedMicros, limitRequests: 3, limitMicros: 1_000_000,
    atomicAcrossProcesses: false, providerUsageReconciled: false,
    publicReady: false, operationalEffects: false
  };
}

async function fixture(t, { reserveCount = 2 } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r161-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ledger = createFaiscaLocalReservationLedger({
    directory, maxRequests: 3, maxBudgetUsd: 1
  });
  let answers = 0;
  const lab = {
    answer: async () => { throw new Error('fixed scenario must not run'); },
    answerPrivateConversation: async () => {
      answers++;
      if (reserveCount >= 1) await ledger.reserve(0.02);
      if (reserveCount >= 2) await ledger.reserve(0.03);
      return {
        status: 'general_answer', text: safeAnswer, sourceIds: [],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra'],
        publicReady: false, operationalEffects: false
      };
    },
    inspect: () => ({ syntheticOnly: true })
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: TOKEN, enablePrivateConversation: true
  });
  t.after(() => server.close());
  return { ledger, server, answers: () => answers };
}

function safe(result) {
  assert.equal(result.publicReady, false);
  assert.equal(result.operationalEffects, false);
  assert.equal(result.ledgerReconciled, false);
  assert.equal(result.providerTransportVerified, false);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
  assert.equal(JSON.stringify(result).includes(safeAnswer), false);
}

test('R161 rejects fabricated snapshots, limits and counter rollback', () => {
  const s0 = snapshot(0, 0);
  const s2 = snapshot(2, 50000);
  assert.equal(validFaiscaLocalLedgerSnapshot(s0), true);
  assert.equal(matchFaiscaLocalLedgerDelta(s0, s0, 0), true);
  assert.equal(matchFaiscaLocalLedgerDelta(s0, s2, 2), true);
  for (const bad of [
    { ...s0, apiKey: 'SYNTHETIC_ONLY' },
    { ...s0, providerUsageReconciled: true },
    { ...s0, atomicAcrossProcesses: true },
    { ...s0, requests: -1 }, { ...s0, requests: 100 },
    { ...s0, limitRequests: 1000 }, { ...s0, limitMicros: 0 },
    { ...s0, reservedMicros: Number.MAX_SAFE_INTEGER },
    { ...s0, schema: 'arbitrary' },
    Object.assign(Object.create(null), s0),
    null
  ]) assert.equal(validFaiscaLocalLedgerSnapshot(bad), false);
  assert.equal(matchFaiscaLocalLedgerDelta(s0, s2, 0), false);
  assert.equal(matchFaiscaLocalLedgerDelta(s0, snapshot(1, 20000), 2), false);
  assert.equal(matchFaiscaLocalLedgerDelta(s0, snapshot(2, 0), 2), false);
  assert.equal(matchFaiscaLocalLedgerDelta(s2, s0, 0), false);
  assert.equal(matchFaiscaLocalLedgerDelta(s0, { ...s2, limitMicros: 900000 }, 2), false);
  assert.equal(matchFaiscaLocalLedgerDelta(s0, s2, 1), false);
});

test('R161 HTTP sequence: genuine R160 ledger proves zero negative reservations and two positive synthetic reservations', async t => {
  const f = await fixture(t);
  let posts = 0;
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: f.server.address, enabled: true, reviewToken: TOKEN,
    inspectLedger: () => f.ledger.inspectReadOnly(),
    fetchImpl: (url, init) => {
      if (init.method === 'POST') posts++;
      return fetch(url, init);
    }
  });
  assert.equal(result.status, 'PRIVATE_SYNTHETIC_SEQUENCE_ENVELOPES_VERIFIED');
  assert.equal(result.localLedgerDeltasVerified, true);
  assert.equal(result.apiRequests, 2);
  assert.equal(posts, 2);
  assert.equal(f.answers(), 1);
  assert.equal((await f.ledger.inspectReadOnly()).requests, 2);
  safe(result);
});

test('R161 injected ledger spend after rejected question BLOCKS positive HTTP before any model invocation', async t => {
  const f = await fixture(t);
  let reads = 0, posts = 0;
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: f.server.address, enabled: true, reviewToken: TOKEN,
    inspectLedger: async () => {
      reads++;
      if (reads === 2) await f.ledger.reserve(0.01);
      return f.ledger.inspectReadOnly();
    },
    fetchImpl: (url, init) => {
      if (init.method === 'POST') posts++;
      return fetch(url, init);
    }
  });
  assert.equal(result.status, 'BLOCKED_LEDGER_GATE');
  assert.equal(result.negativeInputRejected, true);
  assert.equal(result.positiveEnvelopeAccepted, false);
  assert.equal(result.localLedgerDeltasVerified, false);
  assert.equal(posts, 1);
  assert.equal(f.answers(), 0);
  safe(result);
});

test('R161 one reserved call cannot masquerade as the two Luna/Terra reservations', async t => {
  const f = await fixture(t, { reserveCount: 1 });
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: f.server.address, enabled: true, reviewToken: TOKEN,
    inspectLedger: () => f.ledger.inspectReadOnly()
  });
  assert.equal(result.status, 'BLOCKED_LEDGER_GATE');
  assert.equal(result.positiveEnvelopeAccepted, true);
  assert.equal(result.localLedgerDeltasVerified, false);
  assert.equal(f.answers(), 1);
  assert.equal((await f.ledger.inspectReadOnly()).requests, 1);
  safe(result);
});

test('R161 bad inspector or read failure is fail-closed and does not dispatch a positive question', async t => {
  const f = await fixture(t);
  let posts = 0;
  const fetchImpl = (url, init) => {
    if (init.method === 'POST') posts++;
    return fetch(url, init);
  };
  for (const inspectLedger of [true, async () => ({ ...snapshot(), extra: 'data' })]) {
    const result = await inspectFaiscaPrivateConversationSequence({
      origin: f.server.address, enabled: true, reviewToken: TOKEN, inspectLedger, fetchImpl
    });
    assert.equal(result.status, inspectLedger === true ?
      'BLOCKED_INVALID_PRIVATE_CONFIGURATION' : 'BLOCKED_LEDGER_GATE');
    safe(result);
  }
  let reads = 0;
  const afterNegative = await inspectFaiscaPrivateConversationSequence({
    origin: f.server.address, enabled: true, reviewToken: TOKEN,
    inspectLedger: async () => {
      reads++;
      if (reads === 2) throw Error('simulated I/O failure - no path leaked');
      return f.ledger.inspectReadOnly();
    },
    fetchImpl
  });
  assert.equal(afterNegative.status, 'BLOCKED_LEDGER_GATE');
  assert.equal(afterNegative.localLedgerDeltasVerified, false);
  assert.equal(posts, 1);
  assert.equal(f.answers(), 0);
  safe(afterNegative);
});

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
import { auditFaiscaPrivateProviderAggregate } from '../ops/faisca/openai/private-provider-aggregate-audit.mjs';

const TOKEN = 'R166_PRIVATE_SYNTHETIC_OPERATOR_ONLY_NO_REAL_SECRET';
const KEY = 'sk-r166-synthetic-transport-fixture-not-real-key';
const ANSWER = 'Uma landing page apresenta o contexto de um evento inteiramente ficticio.';

const aggregate = (calls, cost = 0) => ({
  schema: 'faisca.private-provider-aggregate-evidence.v1',
  scope: 'isolated_private_review_only',
  lunaRequests: calls.filter(model => model === FAISCA_OPENAI_MODELS.classification).length,
  terraRequests: calls.filter(model => model === FAISCA_OPENAI_MODELS.answer).length,
  totalRequests: calls.length, actualCostMicros: cost,
  publicReady: false, operationalEffects: false
});

function providerFixture(model, data) {
  return new Response(JSON.stringify({
    model, status: 'completed', usage: { input_tokens: 100, output_tokens: 20 },
    output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(data) }] }]
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function scenario(t, { failTerra = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r166-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ledger = createFaiscaLocalReservationLedger({
    directory, maxRequests: 3, maxBudgetUsd: 1
  });
  const providerCalls = [];
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: KEY, enablePrivateConversation: true,
    extendedPrivateSession: true, maxRequests: 20, maxBudgetUsd: 10,
    reservationLedger: ledger,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'error');
      const payload = JSON.parse(init.body);
      assert.equal(payload.store, false);
      assert.deepEqual(payload.tools, []);
      assert.equal(payload.tool_choice, 'none');
      providerCalls.push(payload.model);
      if (payload.model === FAISCA_OPENAI_MODELS.classification) {
        return providerFixture(payload.model, { topic: 'general' });
      }
      assert.equal(payload.model, FAISCA_OPENAI_MODELS.answer);
      return failTerra ? new Response('unavailable', { status: 503 }) :
        providerFixture(payload.model, { reply: ANSWER });
    }
  });
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: TOKEN, enablePrivateConversation: true
  });
  t.after(() => server.close());
  return { ledger, server, providerCalls };
}

test('R166 real loopback HTTP + mock Luna/Terra + durable reservations + numeric aggregate comparison', async t => {
  const f = await scenario(t);
  const before = await f.ledger.inspectReadOnly();
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: f.server.address, reviewToken: TOKEN, enabled: true,
    inspectLedger: () => f.ledger.inspectReadOnly()
  });
  const after = await f.ledger.inspectReadOnly();
  assert.equal(result.status, 'PRIVATE_SYNTHETIC_SEQUENCE_ENVELOPES_VERIFIED');
  assert.equal(result.negativeInputRejected, true);
  assert.equal(result.apiRequests, 2);
  assert.deepEqual(f.providerCalls, [
    FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
  ]);
  const audit = auditFaiscaPrivateProviderAggregate({
    before, after, evidence: aggregate(f.providerCalls), outcome: 'success'
  });
  assert.equal(audit.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(audit.localRequests, 2);
  assert.equal(audit.providerUsageReconciled, false);
  assert.equal(audit.externalAttestationVerified, false);
  assert.equal(audit.publicReady, false);
  const wrongCount = auditFaiscaPrivateProviderAggregate({
    before, after, evidence: aggregate([FAISCA_OPENAI_MODELS.classification]), outcome: 'success'
  });
  assert.equal(wrongCount.status, 'BLOCKED_REQUEST_MISMATCH');
  const insufficientEstimate = auditFaiscaPrivateProviderAggregate({
    before, after, evidence: aggregate(f.providerCalls, audit.localReservedMicros + 1),
    outcome: 'success'
  });
  assert.equal(insufficientEstimate.status, 'BLOCKED_COST_EXCEEDS_RESERVATION');
  for (const object of [result, audit, wrongCount, insufficientEstimate]) {
    const serialized = JSON.stringify(object);
    for (const secret of [TOKEN, KEY, ANSWER, 'sk-']) {
      assert.equal(serialized.includes(secret), false);
    }
  }
});

test('R166 Terra HTTP 503 still consumes two reservations; audit must never imply refund or public readiness', async t => {
  const f = await scenario(t, { failTerra: true });
  const before = await f.ledger.inspectReadOnly();
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: f.server.address, reviewToken: TOKEN, enabled: true,
    inspectLedger: () => f.ledger.inspectReadOnly()
  });
  const after = await f.ledger.inspectReadOnly();
  assert.equal(result.status, 'BLOCKED_POSITIVE_GATE');
  assert.equal(result.failedPositiveReservedRequests, 2);
  assert.equal(f.providerCalls.length, 2);
  assert.equal(after.requests - before.requests, 2);
  const audit = auditFaiscaPrivateProviderAggregate({
    before, after, evidence: aggregate(f.providerCalls), outcome: 'failed_terra'
  });
  assert.equal(audit.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(audit.providerUsageReconciled, false);
  assert.equal(audit.publicReady, false);
  assert.equal(audit.operationalEffects, false);
});

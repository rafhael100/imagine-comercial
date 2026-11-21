import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { inspectFaiscaPrivateConversationSequence } from '../ops/faisca/openai/private-staging-sequence.mjs';
import { inspectFaiscaOfflineOperatorAggregate } from '../ops/faisca/openai/private-provider-operator-audit.mjs';

const TOKEN = 'R170_SYNTHETIC_LOOPBACK_OPERATOR_ONLY';
const KEY = 'sk-r170-fake-synthetic-transport-fixture';
const REPLY = 'Uma landing page apresenta um projeto totalmente ficticio.';

function providerResponse(model, message) {
  return new Response(JSON.stringify({
    model, status: 'completed',
    usage: { input_tokens: 100, output_tokens: 20 },
    output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(message) }] }]
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function scenario(t, { failTerra = false } = {}) {
  const ledgerDir = await mkdtemp(join(tmpdir(), 'faisca-r170-ledger-'));
  const auditDir = await mkdtemp(join(tmpdir(), 'faisca-r170-audit-'));
  await chmod(ledgerDir, 0o700);
  await chmod(auditDir, 0o700);
  t.after(() => rm(ledgerDir, { recursive: true, force: true }));
  t.after(() => rm(auditDir, { recursive: true, force: true }));

  const ledger = createFaiscaLocalReservationLedger({
    directory: ledgerDir, maxRequests: 3, maxBudgetUsd: 1
  });
  const calls = [];
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: KEY, enablePrivateConversation: true,
    extendedPrivateSession: true, maxRequests: 20, maxBudgetUsd: 10,
    reservationLedger: ledger,
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'error');
      const request = JSON.parse(init.body);
      assert.equal(request.store, false);
      assert.deepEqual(request.tools, []);
      assert.equal(request.tool_choice, 'none');
      calls.push(request.model);
      if (request.model === FAISCA_OPENAI_MODELS.classification) {
        return providerResponse(request.model, { topic: 'general' });
      }
      assert.equal(request.model, FAISCA_OPENAI_MODELS.answer);
      return failTerra
        ? new Response('unavailable', { status: 503 })
        : providerResponse(request.model, { reply: REPLY });
    }
  });
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: TOKEN, enablePrivateConversation: true
  });
  t.after(() => server.close());

  const before = await ledger.inspectReadOnly();
  const sequence = await inspectFaiscaPrivateConversationSequence({
    origin: server.address, reviewToken: TOKEN, enabled: true,
    inspectLedger: () => ledger.inspectReadOnly()
  });
  const after = await ledger.inspectReadOnly();
  async function put(name, value) {
    await writeFile(join(auditDir, name), JSON.stringify(value) + '\n', {
      mode: 0o600
    });
  }
  const aggregate = {
    schema: 'faisca.private-provider-aggregate-evidence.v1',
    scope: 'isolated_private_review_only',
    lunaRequests: calls.filter(x => x === FAISCA_OPENAI_MODELS.classification).length,
    terraRequests: calls.filter(x => x === FAISCA_OPENAI_MODELS.answer).length,
    totalRequests: calls.length, actualCostMicros: 0,
    publicReady: false, operationalEffects: false
  };
  await put('before.json', before);
  await put('after.json', after);
  await put('aggregate.json', aggregate);
  return { calls, before, after, sequence, aggregate, auditDir, put };
}

test('R170 loopback HTTP + Luna/Terra fixture + durable ledger + offline 0600 evidence remains review-only', async t => {
  const s = await scenario(t);
  assert.equal(s.sequence.status, 'PRIVATE_SYNTHETIC_SEQUENCE_ENVELOPES_VERIFIED');
  assert.equal(s.sequence.negativeInputRejected, true);
  assert.equal(s.sequence.apiRequests, 2);
  assert.deepEqual(s.calls, [
    FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
  ]);
  assert.equal(s.after.requests - s.before.requests, 2);

  const report = await inspectFaiscaOfflineOperatorAggregate({
    directory: s.auditDir, outcome: 'success'
  });
  assert.equal(report.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(report.localRequests, 2);
  assert.equal(report.providerUsageReconciled, false);
  assert.equal(report.externalAttestationVerified, false);
  assert.equal(report.publicReady, false);

  // A syntactically valid, but numerically false provider aggregate must
  // block without reusing the network or modifying reservations.
  await s.put('aggregate.json', {
    ...s.aggregate, lunaRequests: 1, terraRequests: 0, totalRequests: 1
  });
  const altered = await inspectFaiscaOfflineOperatorAggregate({
    directory: s.auditDir, outcome: 'success'
  });
  assert.equal(altered.status, 'BLOCKED_REQUEST_MISMATCH');
  assert.equal(s.calls.length, 2);
  assert.equal(s.after.requests, 2);
  for (const reportObject of [report, altered]) {
    const text = JSON.stringify(reportObject);
    for (const secret of [TOKEN, KEY, REPLY, 'sk-']) {
      assert.equal(text.includes(secret), false);
    }
  }
});

test('R170 failed Terra HTTP 503 conserves two reservations and offline audit refuses false costs', async t => {
  const s = await scenario(t, { failTerra: true });
  assert.equal(s.sequence.status, 'BLOCKED_POSITIVE_GATE');
  assert.equal(s.sequence.failedPositiveReservedRequests, 2);
  assert.equal(s.after.requests - s.before.requests, 2);
  assert.equal(s.calls.length, 2);

  const report = await inspectFaiscaOfflineOperatorAggregate({
    directory: s.auditDir, outcome: 'failed_terra'
  });
  assert.equal(report.status, 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW');
  assert.equal(report.providerUsageReconciled, false);
  const reserved = s.after.reservedMicros - s.before.reservedMicros;
  await s.put('aggregate.json', { ...s.aggregate, actualCostMicros: reserved + 1 });
  const blocked = await inspectFaiscaOfflineOperatorAggregate({
    directory: s.auditDir, outcome: 'failed_terra'
  });
  assert.equal(blocked.status, 'BLOCKED_COST_EXCEEDS_RESERVATION');
  assert.equal(blocked.publicReady, false);
  assert.equal(s.calls.length, 2);
});

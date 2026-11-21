import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { FAISCA_OPENAI_MODELS, createFaiscaOpenAILiveLab } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { inspectFaiscaPrivateConversationSequence } from '../ops/faisca/openai/private-staging-sequence.mjs';

// R193: cumulative, no-key, no-network-upstream proof of R95 -> R192.
// Not an operator/VPS staging receipt, not actual OpenAI billing evidence.
const token = 'R193_PRIVATE_SYNTHETIC_ONLY_TOKEN_123456789';
const fakeKey = 'sk-r193-synthetic-fixture-no-real-key-1234567';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const answer = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
const endpoint = '/__faisca_openai_private/converse';

function providerResponse(model, payload) {
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [
      { type: 'output_text', text: JSON.stringify(payload) }
    ] }],
    usage: { input_tokens: 180, output_tokens: 35 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function privatePost(server, text) {
  return fetch(server.address + endpoint, {
    method: 'POST', redirect: 'error', cache: 'no-store', credentials: 'omit',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, text])
  });
}

test('R193 cumulative private R95-R192: negative, actual loopback HTTP, two synthetic model transports, durable no-start after restart', async t => {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r193-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'ledger');
  await mkdir(directory, { mode: 0o700 });
  const ledger = () => createFaiscaLocalReservationLedger({
    directory, maxRequests: 8, maxBudgetUsd: 1
  });
  let mode = 'success', providerCalls = 0, afterRestartCalls = 0;
  const transport = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(options.signal instanceof AbortSignal, true);
    const payload = JSON.parse(options.body);
    assert.equal(payload.store, false);
    assert.deepEqual(payload.tools, []);
    assert.equal(payload.tool_choice, 'none');
    providerCalls++;
    if (mode === 'fail') return new Response('fixture failure', { status: 503 });
    return providerResponse(payload.model, payload.model === FAISCA_OPENAI_MODELS.classification
      ? { topic: 'general' } : { reply: answer });
  };
  const lab = (fetchImpl) => createFaiscaOpenAILiveLab({
    enabled: true, apiKey: fakeKey, enablePrivateConversation: true,
    extendedPrivateSession: true, maxRequests: 8, maxBudgetUsd: 1,
    reservationLedger: ledger(), fetchImpl
  });
  const server = await startFaiscaOpenAIPrivateReview({
    lab: lab(transport), reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const sequence = await inspectFaiscaPrivateConversationSequence({
    origin: server.address, reviewToken: token, enabled: true,
    inspectLedger: () => ledger().inspectReadOnly(),
    fetchImpl: (url, init) => {
      assert.equal(url.startsWith(server.address + '/__faisca_openai_private/'), true);
      return fetch(url, init);
    }
  });
  assert.equal(sequence.status, 'PRIVATE_SYNTHETIC_SEQUENCE_ENVELOPES_VERIFIED');
  assert.equal(sequence.negativeInputRejected, true);
  assert.equal(sequence.positiveEnvelopeAccepted, true);
  assert.equal(sequence.localLedgerDeltasVerified, true);
  assert.equal(sequence.apiRequests, 2, 'negative plus positive loopback requests');
  assert.equal(sequence.providerTransportVerified, false);
  assert.equal(sequence.ledgerReconciled, false);
  assert.equal(sequence.publicReady, false);
  assert.equal(sequence.operationalEffects, false);
  assert.equal(providerCalls, 2, 'one Luna and one Terra, no paid endpoint');
  assert.equal((await ledger().inspectReadOnly()).requests, 2);
  assert.equal(JSON.stringify(sequence).includes(question), false);
  assert.equal(JSON.stringify(sequence).includes(answer), false);
  assert.equal(JSON.stringify(sequence).includes(token), false);
  assert.equal(JSON.stringify(sequence).includes(fakeKey), false);

  mode = 'fail';
  const failed = await privatePost(server, question);
  assert.equal(failed.status, 503);
  const failedBody = await failed.json();
  assert.equal(failedBody.status, 'unavailable');
  assert.doesNotMatch(JSON.stringify(failedBody), /sk-r193|PRIVATE_SYNTHETIC|landing page|ledger|apiKey/i);
  assert.equal(providerCalls, 3, 'single simulated failed classification, no retries');
  assert.equal((await ledger().inspectReadOnly()).requests, 3);
  assert.equal(await readFile(join(directory, '.faisca-provider-outcome-uncertain'), 'utf8'),
    'faisca.private-provider-outcome-uncertain.v1\n');
  await server.close();

  const restarted = await startFaiscaOpenAIPrivateReview({
    lab: lab(async () => {
      afterRestartCalls++;
      throw new Error('No upstream transport after durable provider uncertainty');
    }), reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => restarted.close());
  for (let i = 0; i < 2; i++) {
    const response = await privatePost(restarted, question);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    const body = await response.json();
    assert.equal(body.status, 'unavailable');
    assert.doesNotMatch(JSON.stringify(body), /sk-r193|PRIVATE_SYNTHETIC|landing page|ledger|apiKey/i);
  }
  assert.equal(afterRestartCalls, 0);
  assert.equal((await ledger().inspectReadOnly()).requests, 3,
    'No quota reset or second paid dispatch after restarting the process');
  await assert.rejects(ledger().ready(), /operator reconciliation/);
});

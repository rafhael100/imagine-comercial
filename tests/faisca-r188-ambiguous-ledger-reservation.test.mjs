import test from 'node:test';
import assert from 'node:assert/strict';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';

const apiKey = 'sk-synthetic-r188-no-real-key-anywhere-1234';
function setup(reservationLedger, fetchImpl) {
  return createFaiscaOpenAILiveLab({
    enabled: true, apiKey, extendedPrivateSession: true,
    maxRequests: 10, maxBudgetUsd: 1, reservationLedger, fetchImpl
  });
}

test('R188 committed-but-unacknowledged durable reservation fails closed without a paid request or second reserve', async () => {
  let persisted = 0, attempts = 0, dispatches = 0;
  const client = setup({
    async reserve(usd) {
      attempts++;
      persisted += usd; // A store committed before its acknowledgement failed.
      throw new Error('synthetic-private-store-secret-path-must-not-leak');
    }
  }, async () => { dispatches++; throw new Error('unexpected network'); });

  await assert.rejects(client.answer('compare'), error =>
    error.message === 'OpenAI private test unavailable.' &&
    !error.message.includes('synthetic-private-store-secret-path'));
  assert.equal(attempts, 1);
  assert.ok(persisted > 0);
  assert.equal(dispatches, 0);
  assert.equal(client.inspect().calls, 0);
  assert.equal(client.inspect().reservedUsd, 0, 'Locally unacknowledged spend must not be reported as confirmed');

  await assert.rejects(client.answer('process'), /OpenAI private test unavailable/);
  assert.equal(attempts, 1, 'A second reservation might duplicate already persisted spend');
  assert.equal(dispatches, 0, 'No transport request is allowed after ambiguous reserve');
});

test('R188 rejected reservation before commit also fails closed for the entire private lab session', async () => {
  let attempts = 0, dispatches = 0;
  const client = setup({
    reserve() { attempts++; return Promise.reject(new Error('synthetic unavailable store')); }
  }, async () => { dispatches++; throw new Error('unexpected network'); });
  await assert.rejects(client.answer('compare'), /OpenAI private test unavailable/);
  await assert.rejects(client.answer('compare'), /OpenAI private test unavailable/);
  assert.equal(attempts, 1);
  assert.equal(dispatches, 0);
});

test('R188 acknowledged reservation still allows a single valid synthetic Luna response', async () => {
  let reservations = 0, dispatches = 0;
  const client = setup({
    async reserve(usd) {
      assert.ok(usd > 0);
      reservations++;
    }
  }, async (url, init) => {
    dispatches++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const payload = JSON.parse(init.body);
    assert.equal(payload.model, FAISCA_OPENAI_MODELS.classification);
    assert.equal(payload.store, false);
    return new Response(JSON.stringify({
      model: FAISCA_OPENAI_MODELS.classification, status: 'completed',
      output: [{ type: 'message', role: 'assistant',
        content: [{ type: 'output_text', text: '{"answerId":"none"}' }] }],
      usage: { input_tokens: 12, output_tokens: 3 }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const result = await client.answer('compare');
  assert.equal(result.status, 'unsupported');
  assert.equal(reservations, 1);
  assert.equal(dispatches, 1);
  assert.equal(client.inspect().calls, 1);
  assert.ok(client.inspect().reservedUsd > 0);
});

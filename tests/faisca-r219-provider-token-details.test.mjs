import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// All transport, identities and messages below are fictional. No paid API.
const key = 'sk-r219-synthetic-never-a-real-secret-123456';
const bearer = 'R219_SYNTHETIC_OPERATOR_LOCAL_ONLY_TOKEN_123456';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const reply = 'Uma landing page pode organizar a programação de um evento fictício e orientar seus participantes.';
const raw = Object.freeze({ scope: 'local_operator_lab', attestedSynthetic: true, question });

function response(model, details = {}) {
  const usage = {
    input_tokens: 180, output_tokens: 35, total_tokens: 215,
    input_tokens_details: { cached_tokens: 30 },
    output_tokens_details: { reasoning_tokens: 5 }
  };
  Object.assign(usage, details);
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [{
      type: 'output_text', text: JSON.stringify(
        model === FAISCA_OPENAI_MODELS.classification
          ? { topic: 'general' } : { reply }
      )
    }] }],
    usage
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r219-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'ledger');
  await mkdir(directory, { mode: 0o700 });
  return {
    directory,
    ledger: () => createFaiscaLocalReservationLedger({
      directory, maxRequests: 8, maxBudgetUsd: 1
    })
  };
}
function lab(ledger, fetchImpl) {
  return createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, enablePrivateConversation: true,
    extendedPrivateSession: true, maxRequests: 8, maxBudgetUsd: 1,
    reservationLedger: ledger, fetchImpl
  });
}
function post(server) {
  return fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', redirect: 'error', cache: 'no-store', credentials: 'omit',
    headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, question])
  });
}

async function assertRejected(t, modelToCorrupt, detail, expectedCalls) {
  const { directory, ledger } = await fixture(t);
  let calls = 0;
  const client = lab(ledger(), async (_url, init) => {
    const payload = JSON.parse(init.body);
    assert.equal(payload.store, false);
    assert.deepEqual(payload.tools, []);
    assert.equal(payload.tool_choice, 'none');
    calls++;
    return response(payload.model, payload.model === modelToCorrupt ? detail : {});
  });
  const server = await startFaiscaOpenAIPrivateReview({
    lab: client, reviewToken: bearer, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const rejected = await post(server);
  assert.equal(rejected.status, 503);
  assert.match(rejected.headers.get('cache-control'), /no-store/);
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
  const body = await rejected.text();
  assert.equal(JSON.parse(body).status, 'unavailable');
  assert.doesNotMatch(body, /R219_SYNTHETIC|sk-r219|cached_tokens|reasoning_tokens|landing page/i);
  assert.equal(calls, expectedCalls, 'invalid Luna must never dispatch Terra');
  assert.equal(server.inspect().providerUnavailable, true);
  await server.close();
  assert.equal(await readFile(join(directory, '.faisca-provider-outcome-uncertain'), 'utf8'),
    'faisca.private-provider-outcome-uncertain.v1\n');
  assert.equal((await ledger().inspectReadOnly()).requests, expectedCalls);
  await assert.rejects(ledger().ready(), /operator reconciliation/);
  let restartedCalls = 0;
  const restarted = lab(ledger(), async () => {
    restartedCalls++;
    throw new Error('No new provider request after a contradictory receipt');
  });
  await assert.rejects(restarted.answerPrivateConversation(raw), /OpenAI private test unavailable/);
  assert.equal(restartedCalls, 0);
  assert.equal(restarted.inspect().calls, 0);
}

test('R219 Luna cached_tokens cannot exceed input_tokens; durable NO-START after restart', async t => {
  await assertRejected(t, FAISCA_OPENAI_MODELS.classification,
    { input_tokens_details: { cached_tokens: 181 } }, 1);
});
test('R219 Terra reasoning_tokens cannot exceed output_tokens; both reservations survive', async t => {
  await assertRejected(t, FAISCA_OPENAI_MODELS.answer,
    { output_tokens_details: { reasoning_tokens: 36 } }, 2);
});
test('R219 malformed negative or fractional detail usage rejects before second call', async t => {
  await assertRejected(t, FAISCA_OPENAI_MODELS.classification,
    { input_tokens_details: { cached_tokens: -1 } }, 1);
});
test('R219 malformed null detail record rejects before second call', async t => {
  await assertRejected(t, FAISCA_OPENAI_MODELS.classification,
    { output_tokens_details: null }, 1);
});
test('R219 valid detailed Luna/Terra receipts allow one safe fictional answer', async t => {
  const { directory, ledger } = await fixture(t);
  let calls = 0;
  const client = lab(ledger(), async (_url, init) => {
    calls++;
    return response(JSON.parse(init.body).model, {});
  });
  const server = await startFaiscaOpenAIPrivateReview({
    lab: client, reviewToken: bearer, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const received = await post(server);
  assert.equal(received.status, 200);
  const result = await received.json();
  assert.equal(result.status, 'general_answer');
  assert.equal(result.answer, reply);
  assert.deepEqual(result.models,
    [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer]);
  assert.deepEqual(result.sources, []);
  assert.equal(result.publicReady, false);
  assert.equal(result.operationalEffects, false);
  assert.equal(calls, 2);
  await server.close();
  assert.equal((await ledger().inspectReadOnly()).requests, 2);
  await assert.rejects(readFile(join(directory, '.faisca-provider-outcome-uncertain'), 'utf8'),
    { code: 'ENOENT' });
  assert.equal(await ledger().ready(), true);
});

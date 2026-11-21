import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// No external provider, real credentials, customer content, or operating services.
const key = 'sk-r204-synthetic-not-a-real-key-123456789';
const token = 'R204_PRIVATE_SYNTHETIC_HTTP_TOKEN_123456789';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const reply = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
const raw = Object.freeze({ scope: 'local_operator_lab', attestedSynthetic: true, question });
const path = '/__faisca_openai_private/converse';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r204-'));
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
function response(model, oversizedField = null) {
  const usage = { input_tokens: 180, output_tokens: 35 };
  if (oversizedField) usage[oversizedField] = 999999;
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [
      { type: 'output_text', text: JSON.stringify(model === FAISCA_OPENAI_MODELS.classification
        ? { topic: 'general' } : { reply }) }
    ] }],
    usage
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}
function lab(ledger, fetchImpl) {
  return createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, enablePrivateConversation: true,
    extendedPrivateSession: true, maxRequests: 8, maxBudgetUsd: 1,
    reservationLedger: ledger, fetchImpl
  });
}
async function post(server) {
  return fetch(server.address + path, {
    method: 'POST', redirect: 'error', cache: 'no-store', credentials: 'omit',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, question])
  });
}

async function verifyOverage(t, overageModel, usageField, expectedCalls) {
  const { directory, ledger } = await fixture(t);
  let calls = 0;
  const initial = lab(ledger(), async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(init.body);
    assert.equal(body.store, false);
    assert.deepEqual(body.tools, []);
    calls++;
    return response(body.model, body.model === overageModel ? usageField : null);
  });
  const server = await startFaiscaOpenAIPrivateReview({
    lab: initial, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const received = await post(server);
  assert.equal(received.status, 503);
  assert.equal(received.headers.get('access-control-allow-origin'), null);
  const body = await received.text();
  assert.equal(JSON.parse(body).status, 'unavailable');
  assert.doesNotMatch(body, /999999|r204|sk-r204|landing page|usage|token|reservation/i);
  assert.equal(calls, expectedCalls, 'No additional provider requests after an over-limit usage receipt');
  assert.equal(server.inspect().providerUnavailable, true);
  await server.close();
  assert.equal(await readFile(join(directory, '.faisca-provider-outcome-uncertain'), 'utf8'),
    'faisca.private-provider-outcome-uncertain.v1\n');
  assert.equal((await ledger().inspectReadOnly()).requests, expectedCalls);
  await assert.rejects(ledger().ready(), /operator reconciliation/);

  let afterRestart = 0;
  const fresh = lab(ledger(), async () => {
    afterRestart++;
    throw new Error('A new provider dispatch is forbidden until review.');
  });
  await assert.rejects(fresh.answerPrivateConversation(raw), /OpenAI private test unavailable/);
  assert.equal(afterRestart, 0, 'Uncertain usage must block a new dispatch across processes');
  assert.equal(fresh.inspect().calls, 0, 'The restarted lab must not consume request budget');
  assert.equal((await ledger().inspectReadOnly()).requests, expectedCalls);
}

test('R204 oversized Luna input usage blocks Terra, closes HTTP and survives restart', async t => {
  await verifyOverage(t, FAISCA_OPENAI_MODELS.classification, 'input_tokens', 1);
});

test('R204 oversized Terra output usage cannot complete an under-reserved paid turn', async t => {
  await verifyOverage(t, FAISCA_OPENAI_MODELS.answer, 'output_tokens', 2);
});

test('R204 healthy synthetic Luna/Terra usage within the reservation envelope remains functional', async t => {
  const { directory, ledger } = await fixture(t);
  let calls = 0;
  const trial = lab(ledger(), async (_, init) => {
    calls++;
    return response(JSON.parse(init.body).model);
  });
  const result = await trial.answerPrivateConversation(raw);
  assert.equal(result.status, 'general_answer');
  assert.equal(result.text, reply);
  assert.deepEqual(result.modelIds, [FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer]);
  assert.equal(calls, 2);
  assert.equal((await ledger().inspectReadOnly()).requests, 2);
  await assert.rejects(readFile(join(directory, '.faisca-provider-outcome-uncertain'), 'utf8'),
    { code: 'ENOENT' });
  assert.equal(await ledger().ready(), true);
});

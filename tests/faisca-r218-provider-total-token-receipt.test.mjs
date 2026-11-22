import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// No real provider, API credential, user message, charges, Portal or VPS.
const key = 'sk-r218-fixture-not-a-real-api-key-123456';
const bearer = 'R218_SYNTHETIC_PRIVATE_OPERATOR_TOKEN_123456';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const safeReply = 'Uma landing page pode organizar a programação de um evento fictício e esclarecer as informações.';
const raw = Object.freeze({ scope: 'local_operator_lab', attestedSynthetic: true, question });

function response(model, total) {
  const usage = { input_tokens: 180, output_tokens: 35 };
  if (total !== undefined) usage.total_tokens = total;
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [
      { type: 'output_text', text: JSON.stringify(model === FAISCA_OPENAI_MODELS.classification
        ? { topic: 'general' } : { reply: safeReply }) }
    ] }],
    usage
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

async function createFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r218-'));
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

function createLab(ledger, fetchImpl) {
  return createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, enablePrivateConversation: true,
    extendedPrivateSession: true, maxRequests: 8, maxBudgetUsd: 1,
    reservationLedger: ledger, fetchImpl
  });
}

async function post(server) {
  return fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', redirect: 'error', cache: 'no-store', credentials: 'omit',
    headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, question])
  });
}

async function assertInvalidReceipt(t, corruptModel, corruptTotal, expectedCalls) {
  const fixture = await createFixture(t);
  let called = 0;
  const first = createLab(fixture.ledger(), async (_url, init) => {
    const model = JSON.parse(init.body).model;
    called++;
    return response(model, model === corruptModel ? corruptTotal : 215);
  });
  const server = await startFaiscaOpenAIPrivateReview({
    lab: first, reviewToken: bearer, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const denied = await post(server);
  assert.equal(denied.status, 503);
  assert.match(denied.headers.get('cache-control'), /no-store/);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  const body = await denied.text();
  assert.equal(JSON.parse(body).status, 'unavailable');
  assert.doesNotMatch(body, /R218_SYNTHETIC|landing page|fixture|total_tokens|216|api-key/i);
  assert.equal(called, expectedCalls, 'never dispatch Terra after invalid Luna usage');
  assert.equal(server.inspect().providerUnavailable, true);
  await server.close();
  assert.equal(await readFile(join(fixture.directory, '.faisca-provider-outcome-uncertain'), 'utf8'),
    'faisca.private-provider-outcome-uncertain.v1\n');
  assert.equal((await fixture.ledger().inspectReadOnly()).requests, expectedCalls);
  await assert.rejects(fixture.ledger().ready(), /operator reconciliation/);

  let restartedDispatches = 0;
  const restarted = createLab(fixture.ledger(), async () => {
    restartedDispatches++;
    throw new Error('Second provider dispatch forbidden');
  });
  await assert.rejects(restarted.answerPrivateConversation(raw), /OpenAI private test unavailable/);
  assert.equal(restartedDispatches, 0);
  assert.equal(restarted.inspect().calls, 0);
}

test('R218 inconsistent Luna total_tokens rejects before Terra with durable NO-START', async t => {
  await assertInvalidReceipt(t, FAISCA_OPENAI_MODELS.classification, 216, 1);
});

test('R218 malformed Luna total_tokens rejects before Terra with durable NO-START', async t => {
  await assertInvalidReceipt(t, FAISCA_OPENAI_MODELS.classification, null, 1);
});

test('R218 inconsistent Terra total_tokens leaves both reserved calls and NO-START', async t => {
  await assertInvalidReceipt(t, FAISCA_OPENAI_MODELS.answer, 216, 2);
});

test('R218 consistent Luna/Terra total_tokens receipts remain valid', async t => {
  const fixture = await createFixture(t);
  let calls = 0;
  const live = createLab(fixture.ledger(), async (_url, init) => {
    calls++;
    return response(JSON.parse(init.body).model, 215);
  });
  const answer = await live.answerPrivateConversation(raw);
  assert.equal(answer.status, 'general_answer');
  assert.equal(answer.text, safeReply);
  assert.deepEqual(answer.modelIds, [
    FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
  ]);
  assert.equal(calls, 2);
  assert.equal((await fixture.ledger().inspectReadOnly()).requests, 2);
  await assert.rejects(readFile(join(fixture.directory, '.faisca-provider-outcome-uncertain'), 'utf8'),
    { code: 'ENOENT' });
  assert.equal(await fixture.ledger().ready(), true);
});

test('R218 older synthetic fixtures without total_tokens remain compatible', async t => {
  const fixture = await createFixture(t);
  const live = createLab(fixture.ledger(), async (_url, init) =>
    response(JSON.parse(init.body).model, undefined));
  const answer = await live.answerPrivateConversation(raw);
  assert.equal(answer.status, 'general_answer');
  assert.equal((await fixture.ledger().inspectReadOnly()).requests, 2);
});

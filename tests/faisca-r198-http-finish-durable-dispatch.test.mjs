import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const safeAnswer = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
const bearer = 'R198_SYNTHETIC_HTTP_DELIVERY_BEARER_123456789';
const fakeKey = 'sk-r198-fixture-not-a-real-openai-key-123456';

async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r198-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'ledger');
  await mkdir(directory, { mode: 0o700 });
  const ledger = () => createFaiscaLocalReservationLedger({ directory, maxRequests: 8, maxBudgetUsd: 1 });
  let calls = 0;
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const payload = JSON.parse(options.body);
    assert.equal(payload.store, false);
    assert.deepEqual(payload.tools, []);
    calls++;
    const model = payload.model;
    const output = model === FAISCA_OPENAI_MODELS.classification
      ? { topic: 'general' } : { reply: safeAnswer };
    return new Response(JSON.stringify({
      model, status: 'completed',
      output: [{ type: 'message', role: 'assistant', content: [
        { type: 'output_text', text: JSON.stringify(output) }
      ] }],
      usage: { input_tokens: 180, output_tokens: 35 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const lab = () => createFaiscaOpenAILiveLab({
    enabled: true, apiKey: fakeKey, fetchImpl,
    timeoutMs: 1000, extendedPrivateSession: true,
    maxRequests: 8, maxBudgetUsd: 1,
    enablePrivateConversation: true, reservationLedger: ledger()
  });
  return { directory, ledger, lab, count: () => calls };
}

const input = { scope: 'local_operator_lab', attestedSynthetic: true, question };

test('R198 Luna and Terra share one lock until explicit HTTP finish acknowledgement', async t => {
  const { directory, ledger, lab, count } = await setup(t);
  const model = lab();
  const result = await model.answerPrivateConversation(input, { requireHttpDeliveryAck: true });
  assert.equal(result.status, 'general_answer');
  assert.equal(count(), 2);
  assert.equal(await readFile(join(directory, '.faisca-provider-dispatch-inflight'), 'utf8'),
    'faisca.private-provider-dispatch-inflight.v1\n');
  await assert.rejects(ledger().ready(), /operator review/);
  await assert.rejects(ledger().reserve(0.01), /operator review/);
  await assert.rejects(model.answerPrivateConversation(input, { requireHttpDeliveryAck: true }),
    /Only one private OpenAI trial/);
  assert.equal(count(), 2);
  assert.equal(await model.acknowledgeHttpDelivery(), true);
  await assert.rejects(readFile(join(directory, '.faisca-provider-dispatch-inflight')), /ENOENT/);
  assert.equal(await ledger().ready(), true);
  assert.equal((await ledger().inspectReadOnly()).requests, 2);
});

test('R198 loopback HTTP releases marker after write and allows next synthetic turn', async t => {
  const { directory, ledger, lab, count } = await setup(t);
  const server = await startFaiscaOpenAIPrivateReview({
    lab: lab(), reviewToken: bearer, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const post = () => fetch(server.address + '/__faisca_openai_private/converse', {
    method: 'POST', redirect: 'error',
    headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
    body: JSON.stringify([true, question])
  });
  for (let i = 0; i < 2; i++) {
    const response = await post();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'general_answer');
    assert.equal(body.answer, safeAnswer);
    assert.equal(body.publicReady, false);
    assert.equal(body.operationalEffects, false);
  }
  await server.close();
  assert.equal(count(), 4);
  await assert.rejects(readFile(join(directory, '.faisca-provider-dispatch-inflight')), /ENOENT/);
  assert.equal((await ledger().inspectReadOnly()).requests, 4);
  assert.equal(await ledger().ready(), true);
});

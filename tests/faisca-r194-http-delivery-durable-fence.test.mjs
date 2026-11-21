import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'R194_PRIVATE_HTTP_FIXTURE_BEARER_ONLY_123456';
const fakeKey = 'sk-r194-synthetic-fixture-standin-123456789';
const markerName = '.faisca-provider-outcome-uncertain';

async function waitUntil(predicate) {
  const until = Date.now() + 3000;
  while (!(await predicate())) {
    if (Date.now() >= until) throw new Error('Synthetic private delivery fence was not observed');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
function acceptedResponse() {
  return new Response(JSON.stringify({
    model: FAISCA_OPENAI_MODELS.classification, status: 'completed',
    output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify({ answerId: 'none' }) }] }],
    usage: { input_tokens: 20, output_tokens: 10 }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
async function post(server) {
  return fetch(server.address + server.path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: '{"caseId":"compare"}'
  });
}

test('R194 completed provider output after abandoned private HTTP request creates durable no-start before orderly restart', async t => {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r194-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'ledger');
  await mkdir(directory, { mode: 0o700 });
  const ledger = () => createFaiscaLocalReservationLedger({
    directory, maxRequests: 6, maxBudgetUsd: 1
  });
  let entered, release;
  const started = new Promise(resolve => { entered = resolve; });
  const upstream = new Promise(resolve => { release = resolve; });
  let calls = 0, restartedCalls = 0;
  const createLab = fetchImpl => createFaiscaOpenAILiveLab({
    enabled: true, apiKey: fakeKey, extendedPrivateSession: true,
    maxRequests: 6, maxBudgetUsd: 1, reservationLedger: ledger(), fetchImpl
  });
  const first = await startFaiscaOpenAIPrivateReview({
    lab: createLab(() => { calls++; entered(); return upstream; }), reviewToken: token
  });
  t.after(() => first.close());

  const location = new URL(first.address);
  const client = request({
    hostname: location.hostname, port: Number(location.port),
    path: first.path, method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength('{"caseId":"compare"}') }
  }, res => res.resume());
  client.on('error', () => {}); // expected synthetic ECONNRESET
  client.end('{"caseId":"compare"}');
  await started;
  assert.equal(calls, 1);
  client.destroy();

  await waitUntil(async () => first.inspect().providerUnavailable === true);
  await waitUntil(async () => {
    try { return (await readFile(join(directory, markerName), 'utf8'))
      === 'faisca.private-provider-outcome-uncertain.v1\n'; }
    catch (e) { if (e.code === 'ENOENT') return false; throw e; }
  });
  // This successful provider response cannot undo a lost client delivery.
  release(acceptedResponse());
  await first.close();
  assert.equal((await ledger().inspectReadOnly()).requests, 1);
  await assert.rejects(ledger().ready(), /operator reconciliation/);

  const restarted = await startFaiscaOpenAIPrivateReview({
    lab: createLab(async () => {
      restartedCalls++;
      throw new Error('No second provider dispatch permitted');
    }), reviewToken: token
  });
  t.after(() => restarted.close());
  const response = await post(restarted);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).status, 'unavailable');
  assert.equal(restartedCalls, 0);
  assert.equal((await ledger().inspectReadOnly()).requests, 1);
  assert.equal(restarted.inspect().liveBudget.calls, 0);
});

test('R194 delivery fence is idempotent, hides failure and blocks direct lab invocations', async t => {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r194-direct-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'ledger');
  await mkdir(directory, { mode: 0o700 });
  const ledger = createFaiscaLocalReservationLedger({
    directory, maxRequests: 5, maxBudgetUsd: 1
  });
  let calls = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: fakeKey, extendedPrivateSession: true,
    maxRequests: 5, maxBudgetUsd: 1, reservationLedger: ledger,
    fetchImpl: () => { calls++; throw new Error('should not reach transport'); }
  });
  assert.equal(await lab.markDeliveryUncertain(), true);
  assert.equal(await lab.markDeliveryUncertain(), true);
  await assert.rejects(lab.answer('compare'), /OpenAI private test unavailable/);
  assert.equal(calls, 0);
  assert.equal((await ledger.inspectReadOnly()).requests, 0);
  await assert.rejects(ledger.ready(), /operator reconciliation/);
});

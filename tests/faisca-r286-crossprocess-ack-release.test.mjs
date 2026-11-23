import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { chmod, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// R286: two independent OS processes share only the same host's fsynced quota.
// A verified ACK must release the global fence for a different listener.
// No real API, VPS, data, account or public site is contacted.
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const answer = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
const workerToken = 'R285_SYNTHETIC_WORKER_TOKEN_123456789';
const otherToken = 'R286_SYNTHETIC_OTHER_WORKER_TOKEN_123456789';
const key = 'sk-r286-fixture-not-a-real-provider-key-123456';
const endpoint = '/__faisca_openai_private/converse';

function post(origin, token) {
  return fetch(origin + endpoint, {
    method: 'POST', redirect: 'error',
    headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify([true, question])
  });
}

function untilMessage(child, expected) {
  return new Promise((resolve, reject) => {
    const clear = () => {
      child.off('message', message);
      child.off('exit', exit);
      child.off('error', error);
    };
    function message(value) {
      if (value?.type === expected) { clear(); resolve(value); }
      else if (value?.type === 'worker-error') {
        clear(); reject(new Error('Synthetic worker failure.'));
      }
    }
    function exit() {
      clear(); reject(new Error('Synthetic worker ended early.'));
    }
    function error() {
      clear(); reject(new Error('Synthetic IPC transport failed.'));
    }
    child.on('message', message);
    child.once('exit', exit);
    child.once('error', error);
  });
}

async function stopWorker(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  const timeout = setTimeout(() => child.kill('SIGKILL'), 3500);
  try {
    if (child.connected) child.send({ type: 'shutdown' });
    else child.kill('SIGTERM');
    await exited;
  } finally { clearTimeout(timeout); }
}

test('R286 confirmed first ACK opens the second OS process without resets or unverified provider calls',
  { timeout: 20000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r286-'));
  await chmod(directory, 0o700);
  const config = { directory, maxRequests: 4, maxBudgetUsd: 1 };
  const ledger = () => createFaiscaLocalReservationLedger(config);
  let worker, server;
  try {
    worker = fork(fileURLToPath(new URL('./fixtures/faisca-r285-delayed-ack-worker.mjs', import.meta.url)),
      [directory], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        env: { NODE_ENV: 'test' } });
    const started = await untilMessage(worker, 'listening');
    assert.match(started.address, /^http:\/\/127\.0\.0\.1:\d+$/);
    const pending = untilMessage(worker, 'ack-pending');
    const first = await post(started.address, workerToken);
    assert.equal(first.status, 200);
    assert.equal((await first.json()).status, 'general_answer');
    await pending;
    assert.equal((await ledger().inspectReadOnly()).requests, 2);
    assert.ok((await readdir(directory)).includes('.faisca-provider-dispatch-inflight'));

    const dispatched = [];
    const otherLab = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: key, enablePrivateConversation: true,
      extendedPrivateSession: true, maxRequests: 4, maxBudgetUsd: 1,
      reservationLedger: ledger(),
      fetchImpl: async (url, init) => {
        assert.equal(url, 'https://api.openai.com/v1/responses');
        assert.equal(init.method, 'POST');
        const payload = JSON.parse(init.body);
        assert.equal(payload.store, false);
        assert.deepEqual(payload.tools, []);
        dispatched.push(payload.model);
        const data = payload.model === FAISCA_OPENAI_MODELS.classification
          ? { topic: 'general' } : { reply: answer };
        return new Response(JSON.stringify({
          model: payload.model, status: 'completed',
          output: [{ type: 'message', role: 'assistant',
            content: [{ type: 'output_text', text: JSON.stringify(data) }] }],
          usage: { input_tokens: 200, output_tokens: 35 }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    });
    server = await startFaiscaOpenAIPrivateReview({
      lab: otherLab, reviewToken: otherToken, enablePrivateConversation: true, port: 0
    });
    assert.equal((await post(server.address, null)).status, 403);
    assert.deepEqual(dispatched, []);
    assert.ok(!(await readdir(directory)).includes('.faisca-provider-outcome-uncertain'));

    const completed = untilMessage(worker, 'ack-complete');
    worker.send({ type: 'release' });
    await completed;
    const filesAfterAck = await readdir(directory);
    assert.ok(!filesAfterAck.includes('.faisca-provider-dispatch-inflight'));
    assert.ok(!filesAfterAck.includes('.faisca-provider-outcome-uncertain'));
    assert.equal((await ledger().inspectReadOnly()).requests, 2);
    const second = await post(server.address, otherToken);
    assert.equal(second.status, 200);
    const data = await second.json();
    assert.equal(data.status, 'general_answer');
    assert.equal(data.answer, answer);
    assert.equal(data.publicReady, false);
    assert.equal(data.operationalEffects, false);
    await server.close();
    server = null;
    assert.deepEqual(dispatched, [
      FAISCA_OPENAI_MODELS.classification, FAISCA_OPENAI_MODELS.answer
    ]);
    assert.equal((await ledger().inspectReadOnly()).requests, 4);
    const files = await readdir(directory);
    assert.ok(!files.includes('.faisca-provider-dispatch-inflight'));
    assert.ok(!files.includes('.faisca-provider-outcome-uncertain'));
    for (const file of files) {
      const disk = await readFile(join(directory, file), 'utf8');
      for (const forbidden of [question, answer, workerToken, otherToken, key]) {
        assert.equal(disk.includes(forbidden), false);
      }
    }
    await stopWorker(worker);
    assert.equal(worker.exitCode, 0);
  } finally {
    await stopWorker(worker);
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

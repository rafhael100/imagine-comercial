import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtemp, chmod, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const answer = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';
const workerToken = 'R266_SYNTHETIC_WORKER_TOKEN_123456789';
const competingToken = 'R266_SYNTHETIC_COMPETING_TOKEN_123456789';
const fixtureKey = 'sk-r266-synthetic-parent-not-real-credential-12345';
const path = '/__faisca_openai_private/converse';

function post(address, token) {
  return fetch(address + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: JSON.stringify([true, question])
  });
}

function untilMessage(child, type) {
  return new Promise((resolve, reject) => {
    function cleanup() {
      child.off('message', message);
      child.off('exit', exit);
      child.off('error', error);
    }
    function message(value) {
      if (value?.type === 'worker-error') {
        cleanup();
        reject(new Error('Synthetic subprocess failed without exposing its internal exception.'));
      } else if (value?.type === type) {
        cleanup();
        resolve(value);
      }
    }
    function exit(code) {
      cleanup();
      reject(new Error('Synthetic subprocess exited before ' + type + ' (' + code + ').'));
    }
    function error() {
      cleanup();
      reject(new Error('Synthetic subprocess transport failed.'));
    }
    child.on('message', message);
    child.once('exit', exit);
    child.once('error', error);
  });
}

async function stopWorker(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exit = new Promise(resolve => child.once('exit', resolve));
  const timer = setTimeout(() => child.kill('SIGKILL'), 3500);
  try {
    if (child.connected) child.send({ type: 'shutdown' });
    else child.kill('SIGTERM');
    await exit;
  } finally { clearTimeout(timer); }
}

test('R266 two independent OS processes cannot overlap a private paid HTTP dispatch', { timeout: 20000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r266-'));
  await chmod(directory, 0o700);
  const options = { directory, maxRequests: 4, maxBudgetUsd: 1 };
  let competingServer;
  let worker;
  try {
    // A different OS process serves the first real loopback HTTP request.
    // The child inherits no API key, CI secret or network configuration.
    worker = fork(fileURLToPath(new URL('./fixtures/faisca-r266-private-http-worker.mjs', import.meta.url)),
      [directory], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        env: { NODE_ENV: 'test' } });
    const listening = await untilMessage(worker, 'listening');
    assert.match(listening.address, /^http:\/\/127\.0\.0\.1:\d+$/);
    const entered = untilMessage(worker, 'first-provider-entered');
    const firstResponse = post(listening.address, workerToken);
    firstResponse.catch(() => {}); // Keep teardown safe if the child unexpectedly exits.
    await entered;

    // This second independent HTTP listener has a separate in-memory lab and
    // ledger object but shares the durable 0700 directory with the child.
    let competingCalls = 0;
    const ledger = createFaiscaLocalReservationLedger(options);
    const lab = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: fixtureKey,
      enablePrivateConversation: true, extendedPrivateSession: true,
      maxRequests: 4, maxBudgetUsd: 1,
      reservationLedger: ledger,
      fetchImpl: async () => {
        competingCalls++;
        throw new Error('Competing process must not invoke provider');
      }
    });
    competingServer = await startFaiscaOpenAIPrivateReview({
      lab, reviewToken: competingToken, enablePrivateConversation: true, port: 0
    });
    assert.equal((await post(competingServer.address, null)).status, 403);
    const competing = await post(competingServer.address, competingToken);
    assert.equal(competing.status, 503);
    const rejectedBody = await competing.json();
    assert.equal(rejectedBody.status, 'unavailable');
    assert.equal(typeof rejectedBody.message, 'string');
    assert.doesNotMatch(JSON.stringify(rejectedBody), /credential|sk-r266|token|directory|provider invocation/i);
    assert.equal(competingCalls, 0, 'No paid provider can run from the competing process');
    assert.equal((await ledger.inspectReadOnly()).requests, 1,
      'Only the held first request may reserve allowance');
    assert.ok((await readdir(directory)).includes('.faisca-provider-dispatch-inflight'));

    // Deliberate conservative policy: a rejected *authorized* second worker
    // latches global uncertainty while the first paid provider is in flight.
    // Wait for its fsynced fence before letting the original worker finish.
    await competingServer.close();
    competingServer = null;
    assert.ok((await readdir(directory)).includes('.faisca-provider-outcome-uncertain'));

    worker.send({ type: 'release' });
    const first = await firstResponse;
    assert.equal(first.status, 503,
      'The original worker must fail closed once another worker has fenced the shared ledger');
    const firstBody = await first.json();
    assert.equal(firstBody.status, 'unavailable');
    assert.doesNotMatch(JSON.stringify(firstBody), /credential|sk-r266|token|directory|provider invocation/i);
    await stopWorker(worker);
    assert.equal(worker.exitCode, 0);
    const fresh = createFaiscaLocalReservationLedger(options);
    const snapshot = await fresh.inspectReadOnly();
    assert.equal(snapshot.requests, 1,
      'Only the first synthetic Luna call was reserved before shared NO-START');
    assert.equal(snapshot.providerUsageReconciled, false,
      'This fixture is not independent reconciliation with OpenAI billing');
    assert.equal(snapshot.publicReady, false);
    await assert.rejects(fresh.ready(), /uncertain|review/i);
    const files = await readdir(directory);
    assert.ok(files.includes('.faisca-provider-dispatch-inflight'),
      'The original process cannot remove its dispatch marker after shared uncertainty');
    assert.ok(files.includes('.faisca-provider-outcome-uncertain'),
      'The competing process must leave the durable reconciliation fence');
    for (const file of files) {
      const disk = await readFile(join(directory, file), 'utf8');
      for (const forbidden of [question, answer, workerToken, competingToken, fixtureKey]) {
        assert.equal(disk.includes(forbidden), false,
          'No transcript or synthetic credential may be persisted');
      }
    }
  } finally {
    await stopWorker(worker);
    await competingServer?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

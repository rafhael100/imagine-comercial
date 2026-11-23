import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { chmod, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const workerToken = 'R266_SYNTHETIC_WORKER_TOKEN_123456789';
const competingToken = 'R269_SYNTHETIC_COMPETING_TOKEN_123456789';
const fakeKey = 'sk-r269-synthetic-not-a-real-credential-12345';
const endpoint = '/__faisca_openai_private/converse';

function post(address, token) {
  return fetch(address + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: JSON.stringify([true, question])
  });
}

function waitFor(child, expected) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      child.off('message', message);
      child.off('error', error);
      child.off('exit', exit);
    };
    function message(value) {
      if (value?.type === expected) {
        cleanup();
        resolve(value);
      } else if (value?.type === 'worker-error') {
        cleanup();
        reject(new Error('Synthetic worker failed.'));
      }
    }
    function error() {
      cleanup();
      reject(new Error('Synthetic worker IPC failed.'));
    }
    function exit() {
      cleanup();
      reject(new Error('Worker exited before the Terra barrier.'));
    }
    child.on('message', message);
    child.once('error', error);
    child.once('exit', exit);
  });
}

async function stopWorker(worker) {
  if (!worker || worker.exitCode !== null || worker.signalCode !== null) return;
  const exited = new Promise(resolve => worker.once('exit', resolve));
  const fallback = setTimeout(() => worker.kill('SIGKILL'), 3500);
  try {
    if (worker.connected) worker.send({ type: 'shutdown' });
    else worker.kill('SIGTERM');
    await exited;
  } finally { clearTimeout(fallback); }
}

test('R269 competing process during Terra preserves both reservations and forces independent review', { timeout: 20000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r269-'));
  await chmod(directory, 0o700);
  const options = { directory, maxRequests: 4, maxBudgetUsd: 1 };
  let worker, competingServer;
  try {
    worker = fork(fileURLToPath(new URL('./fixtures/faisca-r266-private-http-worker.mjs', import.meta.url)),
      [directory, 'second'], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        env: { NODE_ENV: 'test' }
      });
    const listening = await waitFor(worker, 'listening');
    assert.match(listening.address, /^http:\/\/127\.0\.0\.1:\d+$/);
    const terraEntered = waitFor(worker, 'second-provider-entered');
    const pendingFirst = post(listening.address, workerToken);
    pendingFirst.catch(() => {});
    await terraEntered;

    // The first listener already completed Luna and durably reserved Terra.
    const before = await readFile(join(directory, 'faisca-reservations.json'), 'utf8');
    assert.equal(JSON.parse(before).requests, 2);
    let unexpectedCalls = 0;
    const competingLab = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: fakeKey, enablePrivateConversation: true,
      extendedPrivateSession: true, maxRequests: 4, maxBudgetUsd: 1,
      reservationLedger: createFaiscaLocalReservationLedger(options),
      fetchImpl: async () => {
        unexpectedCalls++;
        throw new Error('Competing listener must not send provider requests.');
      }
    });
    competingServer = await startFaiscaOpenAIPrivateReview({
      lab: competingLab, reviewToken: competingToken,
      enablePrivateConversation: true, port: 0
    });

    assert.equal((await post(competingServer.address, null)).status, 403);
    const rejected = await post(competingServer.address, competingToken);
    assert.equal(rejected.status, 503);
    assert.equal(rejected.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(rejected.headers.get('access-control-allow-origin'), null);
    const rejectedBody = await rejected.json();
    assert.equal(rejectedBody.status, 'unavailable');
    assert.doesNotMatch(JSON.stringify(rejectedBody), /sk-r269|Competing listener|token|exception|directory/i);
    assert.equal(unexpectedCalls, 0);
    assert.equal((await createFaiscaLocalReservationLedger(options).inspectReadOnly()).requests, 2);

    // Current conservative R266 policy deliberately latches global
    // uncertainty on the second authenticated attempt. This is a known
    // availability tradeoff, not permission to remove or time out the fence.
    await competingServer.close();
    competingServer = null;
    assert.ok((await readdir(directory)).includes('.faisca-provider-outcome-uncertain'));
    worker.send({ type: 'release' });
    const first = await pendingFirst;
    assert.equal(first.status, 503,
      'An original process may not acknowledge a completed turn after a peer fenced the ledger.');
    assert.equal((await first.json()).status, 'unavailable');
    await stopWorker(worker);
    assert.equal(worker.exitCode, 0);

    const snapshot = await createFaiscaLocalReservationLedger(options).inspectReadOnly();
    assert.equal(snapshot.requests, 2);
    assert.equal(snapshot.providerUsageReconciled, false);
    assert.equal(snapshot.publicReady, false);
    assert.equal(await readFile(join(directory, 'faisca-reservations.json'), 'utf8'), before);
    assert.ok((await readdir(directory)).includes('.faisca-provider-dispatch-inflight'));
    await assert.rejects(createFaiscaLocalReservationLedger(options).ready(), /uncertain|review|reconciliation/i);
    for (const entry of await readdir(directory)) {
      const bytes = await readFile(join(directory, entry), 'utf8');
      for (const forbidden of [question, workerToken, competingToken, fakeKey]) {
        assert.equal(bytes.includes(forbidden), false);
      }
    }
  } finally {
    await stopWorker(worker);
    await competingServer?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

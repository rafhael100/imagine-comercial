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

// R285: separate HTTP listeners in two OS processes, using only synthetic
// questions/provider replies and a private disposable same-host ledger.
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const workerToken = 'R285_SYNTHETIC_WORKER_TOKEN_123456789';
const competingToken = 'R285_SYNTHETIC_COMPETING_TOKEN_123456789';
const fakeKey = 'sk-r285-competing-fixture-not-a-real-key-123456';
const endpoint = '/__faisca_openai_private/converse';

function post(address, token) {
  return fetch(address + endpoint, {
    method: 'POST', redirect: 'error',
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
      child.off('exit', exit);
      child.off('error', error);
    };
    function message(value) {
      if (value?.type === expected) {
        cleanup();
        resolve(value);
      } else if (value?.type === 'worker-error') {
        cleanup();
        reject(new Error('Synthetic child failed without exposing internal details.'));
      }
    }
    function exit() {
      cleanup();
      reject(new Error('Synthetic child exited before ' + expected));
    }
    function error() {
      cleanup();
      reject(new Error('Synthetic child transport failure.'));
    }
    child.on('message', message);
    child.once('exit', exit);
    child.once('error', error);
  });
}

async function stopWorker(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exit = new Promise(resolve => child.once('exit', resolve));
  const timeout = setTimeout(() => child.kill('SIGKILL'), 3500);
  try {
    if (child.connected) child.send({ type: 'shutdown' });
    else child.kill('SIGTERM');
    await exit;
  } finally { clearTimeout(timeout); }
}

test('R285 a peer during post-200 ACK cannot dispatch or clear the durable no-start', { timeout: 20000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r285-'));
  await chmod(directory, 0o700);
  const options = { directory, maxRequests: 4, maxBudgetUsd: 1 };
  const newLedger = () => createFaiscaLocalReservationLedger(options);
  let worker, competingServer, restarted;
  try {
    worker = fork(fileURLToPath(new URL('./fixtures/faisca-r285-delayed-ack-worker.mjs', import.meta.url)),
      [directory], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        env: { NODE_ENV: 'test' }
      });
    const listening = await waitFor(worker, 'listening');
    assert.match(listening.address, /^http:\/\/127\.0\.0\.1:\d+$/);
    const pendingAck = waitFor(worker, 'ack-pending');
    const first = await post(listening.address, workerToken);
    assert.equal(first.status, 200, 'First synthetic private answer was already sent.');
    assert.equal((await first.json()).status, 'general_answer');
    await pendingAck;
    assert.equal((await newLedger().inspectReadOnly()).requests, 2);
    const initialFiles = await readdir(directory);
    assert.ok(initialFiles.includes('.faisca-provider-dispatch-inflight'));
    assert.ok(!initialFiles.includes('.faisca-provider-outcome-uncertain'));

    let competingCalls = 0;
    const contender = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: fakeKey, enablePrivateConversation: true,
      extendedPrivateSession: true, maxRequests: 4, maxBudgetUsd: 1,
      reservationLedger: newLedger(),
      fetchImpl: async () => {
        competingCalls++;
        throw new Error('Never dispatch a second provider while another ACK is pending.');
      }
    });
    competingServer = await startFaiscaOpenAIPrivateReview({
      lab: contender, reviewToken: competingToken,
      enablePrivateConversation: true, port: 0
    });
    assert.equal((await post(competingServer.address, null)).status, 403);
    assert.ok(!(await readdir(directory)).includes('.faisca-provider-outcome-uncertain'),
      'An unauthenticated request must not poison an otherwise valid ACK.');
    const denied = await post(competingServer.address, competingToken);
    assert.equal(denied.status, 503);
    assert.equal(denied.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    const body = await denied.text();
    assert.equal(JSON.parse(body).status, 'unavailable');
    assert.doesNotMatch(body, /R285_SYNTHETIC|sk-r285|landing page|directory|ledger|stack/i);
    assert.equal(competingCalls, 0, 'No second paid reservation or provider dispatch.');
    assert.equal((await newLedger().inspectReadOnly()).requests, 2);
    await competingServer.close();
    competingServer = null;
    assert.ok((await readdir(directory)).includes('.faisca-provider-outcome-uncertain'));

    // R266 policy is intentionally conservative: the authenticated peer
    // creates durable uncertainty, even though HTTP 200 was already written.
    // An ACK arriving later cannot silently re-open the shared ledger.
    worker.send({ type: 'release' });
    await stopWorker(worker);
    assert.equal(worker.exitCode, 0);
    const files = await readdir(directory);
    assert.ok(files.includes('.faisca-provider-dispatch-inflight'));
    assert.ok(files.includes('.faisca-provider-outcome-uncertain'));
    await assert.rejects(newLedger().ready(), /uncertain|review|reconciliation/i);

    let replayCalls = 0;
    const replayLab = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: fakeKey, enablePrivateConversation: true,
      extendedPrivateSession: true, maxRequests: 4, maxBudgetUsd: 1,
      reservationLedger: newLedger(),
      fetchImpl: async () => {
        replayCalls++;
        throw new Error('Unexpected replay.');
      }
    });
    restarted = await startFaiscaOpenAIPrivateReview({
      lab: replayLab, reviewToken: competingToken,
      enablePrivateConversation: true, port: 0
    });
    const afterRestart = await post(restarted.address, competingToken);
    assert.equal(afterRestart.status, 503);
    assert.equal((await afterRestart.json()).status, 'unavailable');
    assert.equal(replayCalls, 0);
    await restarted.close();
    restarted = null;

    const snapshot = await newLedger().inspectReadOnly();
    assert.equal(snapshot.requests, 2);
    assert.equal(snapshot.providerUsageReconciled, false);
    assert.equal(snapshot.publicReady, false);
    for (const name of await readdir(directory)) {
      const disk = await readFile(join(directory, name), 'utf8');
      for (const forbidden of [question, workerToken, competingToken, fakeKey]) {
        assert.equal(disk.includes(forbidden), false,
          'No question, answer, token or secret may reach durable storage.');
      }
    }
  } finally {
    await stopWorker(worker);
    await competingServer?.close();
    await restarted?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

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

// R282 verifies the window AFTER a successful HTTP write but BEFORE
// the delayed durable ACK. All answers and request data are synthetic.
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const workerToken = 'R282_SYNTHETIC_WORKER_OPERATOR_TOKEN_123456';
const restartToken = 'R282_SYNTHETIC_RESTART_OPERATOR_TOKEN_123456';
const key = 'sk-r282-fake-provider-fixture-not-real-123456';
const endpoint = '/__faisca_openai_private/converse';

function post(origin, token) {
  return fetch(origin + endpoint, {
    method: 'POST', redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: JSON.stringify([true, question])
  });
}

function waitFor(child, type) {
  return new Promise((resolve, reject) => {
    function cleanup() {
      child.off('message', received);
      child.off('error', errored);
      child.off('exit', exited);
    }
    function received(message) {
      if (message?.type === 'worker-error') {
        cleanup(); reject(new Error('Synthetic ACK worker failed.'));
      } else if (message?.type === type) {
        cleanup(); resolve(message);
      }
    }
    function errored() { cleanup(); reject(new Error('Synthetic worker IPC unavailable.')); }
    function exited() { cleanup(); reject(new Error('Worker exited before ' + type)); }
    child.on('message', received);
    child.once('error', errored);
    child.once('exit', exited);
  });
}

test('R282 SIGKILL after HTTP 200 but before ACK prevents new paid calls after restart',
  { timeout: 20000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r282-'));
  await chmod(directory, 0o700);
  const config = { directory, maxRequests: 4, maxBudgetUsd: 1 };
  let worker, server;
  try {
    worker = fork(fileURLToPath(new URL('./fixtures/faisca-r282-http-ack-worker.mjs', import.meta.url)),
      [directory], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { NODE_ENV: 'test' }
      });
    const listening = await waitFor(worker, 'listening');
    assert.match(listening.address, /^http:\/\/127\.0\.0\.1:\d+$/);
    const ackPending = waitFor(worker, 'ack-inflight');
    const response = await post(listening.address, workerToken);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'general_answer');
    assert.equal(body.publicReady, false);
    assert.equal(body.operationalEffects, false);
    await ackPending;

    const before = await readFile(join(directory, 'faisca-reservations.json'), 'utf8');
    assert.equal(JSON.parse(before).requests, 2,
      'Two fake provider calls must already be reserved and fsynced');
    assert.ok((await readdir(directory)).includes('.faisca-provider-dispatch-inflight'));
    const exited = new Promise(resolve => worker.once('exit', resolve));
    assert.equal(worker.kill('SIGKILL'), true);
    await exited;

    const observed = createFaiscaLocalReservationLedger(config);
    await assert.rejects(observed.ready(), /operator review|uncertain/i);
    let replayCalls = 0;
    const freshLab = () => createFaiscaOpenAILiveLab({
      enabled: true, apiKey: key, enablePrivateConversation: true,
      extendedPrivateSession: true, maxRequests: 4, maxBudgetUsd: 1,
      reservationLedger: createFaiscaLocalReservationLedger(config),
      fetchImpl: async () => {
        replayCalls++;
        throw new Error('Unexpected retry after ACK crash');
      }
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      server = await startFaiscaOpenAIPrivateReview({
        lab: freshLab(), reviewToken: restartToken,
        enablePrivateConversation: true, port: 0
      });
      assert.equal((await post(server.address, null)).status, 403);
      const denied = await post(server.address, restartToken);
      assert.equal(denied.status, 503);
      assert.equal(denied.headers.get('cache-control'), 'no-store, max-age=0');
      assert.equal(denied.headers.get('access-control-allow-origin'), null);
      const denial = await denied.text();
      assert.equal(JSON.parse(denial).status, 'unavailable');
      assert.doesNotMatch(denial, /sk-|R282_SYNTHETIC|ledger|marker|retry/i);
      assert.equal(replayCalls, 0);
      await server.close();
      server = null;
      assert.equal(await readFile(join(directory, 'faisca-reservations.json'), 'utf8'), before);
    }
    const snapshot = await observed.inspectReadOnly();
    assert.equal(snapshot.requests, 2);
    assert.equal(snapshot.providerUsageReconciled, false);
    const files = await readdir(directory);
    assert.ok(files.includes('.faisca-provider-dispatch-inflight'));
    for (const file of files) {
      const disk = await readFile(join(directory, file), 'utf8');
      for (const forbidden of [question, workerToken, restartToken, key]) {
        assert.equal(disk.includes(forbidden), false);
      }
    }
  } finally {
    if (worker?.exitCode === null && worker?.signalCode === null) worker.kill('SIGKILL');
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

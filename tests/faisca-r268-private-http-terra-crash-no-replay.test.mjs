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

// R268: a crash during Terra is different from R267's crash during Luna:
// two paid attempts can already have been reserved, yet no HTTP reply was sent.
// All tokens, messages and provider calls here are deterministic fake fixtures.
const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const workerToken = 'R266_SYNTHETIC_WORKER_TOKEN_123456789';
const restartToken = 'R268_SYNTHETIC_RESTART_TOKEN_123456789';
const dummyKey = 'sk-r268-local-fixture-not-a-provider-credential-12345';
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

function untilMessage(child, expected) {
  return new Promise((resolve, reject) => {
    function done() {
      child.off('message', onMessage);
      child.off('error', onError);
      child.off('exit', onExit);
    }
    function onMessage(message) {
      if (message?.type === 'worker-error') {
        done();
        reject(new Error('Synthetic worker failed before Terra barrier.'));
      } else if (message?.type === expected) {
        done();
        resolve(message);
      }
    }
    function onError() {
      done();
      reject(new Error('Synthetic worker IPC failed.'));
    }
    function onExit() {
      done();
      reject(new Error('Synthetic worker ended before Terra barrier.'));
    }
    child.on('message', onMessage);
    child.once('error', onError);
    child.once('exit', onExit);
  });
}

test('R268 SIGKILL during Terra keeps two reservations and blocks private HTTP replay', { timeout: 20000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r268-'));
  await chmod(directory, 0o700);
  const options = { directory, maxRequests: 4, maxBudgetUsd: 1 };
  let worker, server;
  try {
    // Same reviewed fixture as R266/R267, but holds the SECOND fake provider
    // invocation; the first fake Luna invocation has already returned.
    worker = fork(fileURLToPath(new URL('./fixtures/faisca-r266-private-http-worker.mjs', import.meta.url)),
      [directory, 'second'], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        env: { NODE_ENV: 'test' }
      });
    const listening = await untilMessage(worker, 'listening');
    assert.match(listening.address, /^http:\/\/127\.0\.0\.1:\d+$/);
    const secondEntered = untilMessage(worker, 'second-provider-entered');
    const disconnected = post(listening.address, workerToken);
    disconnected.catch(() => {}); // Intentional disconnect after SIGKILL.
    await secondEntered;

    // Both reservations are durably written before any second-model reply.
    const stateBefore = await readFile(join(directory, 'faisca-reservations.json'), 'utf8');
    assert.equal(JSON.parse(stateBefore).requests, 2);
    assert.ok((await readdir(directory)).includes('.faisca-provider-dispatch-inflight'));

    const exited = new Promise(resolve => worker.once('exit', resolve));
    assert.equal(worker.kill('SIGKILL'), true);
    await exited;
    await disconnected.catch(() => {});

    let duplicateCalls = 0;
    const newLab = () => createFaiscaOpenAILiveLab({
      enabled: true, apiKey: dummyKey,
      enablePrivateConversation: true, extendedPrivateSession: true,
      maxRequests: 4, maxBudgetUsd: 1,
      reservationLedger: createFaiscaLocalReservationLedger(options),
      fetchImpl: async () => {
        duplicateCalls++;
        throw new Error('No model should be called after an uncertain Terra crash.');
      }
    });

    // The marker is intentionally NOT a lease: neither time nor a process
    // restart may clear it or refund either outstanding reservation.
    for (let i = 0; i < 2; i++) {
      server = await startFaiscaOpenAIPrivateReview({
        lab: newLab(), reviewToken: restartToken,
        enablePrivateConversation: true, port: 0
      });
      assert.equal((await post(server.address, null)).status, 403);
      const denied = await post(server.address, restartToken);
      assert.equal(denied.status, 503);
      assert.equal(denied.headers.get('cache-control'), 'no-store, max-age=0');
      assert.equal(denied.headers.get('access-control-allow-origin'), null);
      const body = await denied.json();
      assert.equal(body.status, 'unavailable');
      assert.doesNotMatch(JSON.stringify(body),
        /No model should|credential|sk-r268|directory|token|exception/i);
      assert.equal(duplicateCalls, 0);
      await server.close();
      server = null;
      assert.equal(await readFile(join(directory, 'faisca-reservations.json'), 'utf8'), stateBefore);
    }

    const observer = createFaiscaLocalReservationLedger(options);
    const snapshot = await observer.inspectReadOnly();
    assert.equal(snapshot.requests, 2);
    assert.equal(snapshot.providerUsageReconciled, false);
    assert.equal(snapshot.publicReady, false);
    await assert.rejects(observer.ready(), /operator review/i);
    const files = await readdir(directory);
    assert.ok(files.includes('.faisca-provider-dispatch-inflight'));
    for (const file of files) {
      const bytes = await readFile(join(directory, file), 'utf8');
      for (const forbidden of [question, workerToken, restartToken, dummyKey]) {
        assert.equal(bytes.includes(forbidden), false,
          'No question or credential may be persisted, even after a crash.');
      }
    }
  } finally {
    if (worker?.exitCode === null && worker?.signalCode === null) worker.kill('SIGKILL');
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

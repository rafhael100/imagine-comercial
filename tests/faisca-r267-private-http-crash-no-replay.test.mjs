import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtemp, chmod, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const question = 'Vale a pena usar uma landing page para divulgar um evento?';
const workerToken = 'R266_SYNTHETIC_WORKER_TOKEN_123456789';
const restartedToken = 'R267_SYNTHETIC_RESTARTED_TOKEN_123456789';
const fixtureKey = 'sk-r267-synthetic-only-not-a-real-credential-1234';
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

function waitFor(child, type) {
  return new Promise((resolve, reject) => {
    function cleanup() {
      child.off('message', received);
      child.off('error', errored);
      child.off('exit', exited);
    }
    function received(value) {
      if (value?.type === 'worker-error') {
        cleanup(); reject(new Error('Synthetic subprocess failed.'));
      } else if (value?.type === type) {
        cleanup(); resolve(value);
      }
    }
    function exited() { cleanup(); reject(new Error('Subprocess exited before ' + type)); }
    function errored() { cleanup(); reject(new Error('Synthetic IPC failed.')); }
    child.on('message', received);
    child.once('error', errored);
    child.once('exit', exited);
  });
}

test('R267 hard-killed paid HTTP worker leaves durable NO-START across HTTP restarts', { timeout: 18000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r267-'));
  await chmod(directory, 0o700);
  const options = { directory, maxRequests: 4, maxBudgetUsd: 1 };
  let child, server;
  try {
    child = fork(fileURLToPath(new URL('./fixtures/faisca-r266-private-http-worker.mjs', import.meta.url)),
      [directory], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { NODE_ENV: 'test' } });
    const listening = await waitFor(child, 'listening');
    assert.match(listening.address, /^http:\/\/127\.0\.0\.1:\d+$/);
    const entered = waitFor(child, 'first-provider-entered');
    const disconnected = post(listening.address, workerToken);
    disconnected.catch(() => {}); // Abrupt process termination is expected.
    await entered;
    const first = createFaiscaLocalReservationLedger(options);
    const before = await readFile(join(directory, 'faisca-reservations.json'), 'utf8');
    assert.equal(JSON.parse(before).requests, 1,
      'The synthetic paid attempt must reserve capacity before process termination');

    const exited = new Promise(resolve => child.once('exit', resolve));
    assert.equal(child.kill('SIGKILL'), true, 'Simulate a crash before HTTP delivery acknowledgement');
    await exited;
    await disconnected.catch(() => {});

    assert.ok((await readdir(directory)).includes('.faisca-provider-dispatch-inflight'),
      'The dispatch marker must not be cleaned up by another worker or a TTL');
    await assert.rejects(first.ready(), /operator review/i);
    let sent = 0;
    const createLab = () => createFaiscaOpenAILiveLab({
      enabled: true, apiKey: fixtureKey,
      enablePrivateConversation: true, extendedPrivateSession: true,
      maxRequests: 4, maxBudgetUsd: 1,
      reservationLedger: createFaiscaLocalReservationLedger(options),
      fetchImpl: async () => {
        sent++;
        throw new Error('Forbidden paid redispatch after crash');
      }
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      server = await startFaiscaOpenAIPrivateReview({
        lab: createLab(), reviewToken: restartedToken,
        enablePrivateConversation: true, port: 0
      });
      assert.equal((await post(server.address, null)).status, 403);
      const denied = await post(server.address, restartedToken);
      assert.equal(denied.status, 503);
      assert.equal(denied.headers.get('cache-control'), 'no-store, max-age=0');
      assert.equal(denied.headers.get('access-control-allow-origin'), null);
      const payload = await denied.json();
      assert.equal(payload.status, 'unavailable');
      assert.doesNotMatch(JSON.stringify(payload),
        /Forbidden paid|sk-r267|token|ledger directory|exception/i);
      assert.equal(sent, 0, 'A fresh HTTP process may not send another provider request');
      await server.close();
      server = null;
      assert.equal(await readFile(join(directory, 'faisca-reservations.json'), 'utf8'), before,
        'An uncertain dispatch cannot refund or duplicate the persisted charge');
    }
    for (const entry of await readdir(directory)) {
      const disk = await readFile(join(directory, entry), 'utf8');
      for (const forbidden of [question, workerToken, restartedToken, fixtureKey]) {
        assert.equal(disk.includes(forbidden), false);
      }
    }
  } finally {
    if (child?.exitCode === null && child?.signalCode === null) child.kill('SIGKILL');
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

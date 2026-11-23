import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

// This exercises the actual private HTTP boundary with two independent ledger
// objects over the same directory. No external API, real keys or personal data.
const token = 'R265_LOCAL_OPERATOR_SYNTHETIC_TOKEN_123456';
const key = 'sk-r265-fixture-not-a-real-credential-123456';
const question = 'Vale a pena usar uma landing page para divulgar um evento?';

function post(address, bearer = token) {
  return fetch(address + '/__faisca_openai_private/converse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: 'Bearer ' + bearer } : {})
    },
    body: JSON.stringify([true, question])
  });
}

test('R265 an independently held dispatch marker prevents HTTP-paid calls in another worker', { timeout: 12000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r265-'));
  await chmod(directory, 0o700);
  const options = { directory, maxRequests: 6, maxBudgetUsd: 1 };
  let server;
  try {
    // Simulate another private worker that has already passed the dispatch
    // barrier. Its token and credentials are never available to this server.
    const otherWorker = createFaiscaLocalReservationLedger(options);
    assert.equal(await otherWorker.beginPaidDispatch(), true);
    let calls = 0;
    const thisWorker = createFaiscaLocalReservationLedger(options);
    const lab = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: key, enablePrivateConversation: true,
      extendedPrivateSession: true, maxRequests: 6, maxBudgetUsd: 1,
      reservationLedger: thisWorker,
      fetchImpl: async () => {
        calls++;
        throw new Error('Forbidden cross-worker provider invocation');
      }
    });
    server = await startFaiscaOpenAIPrivateReview({
      lab, reviewToken: token, enablePrivateConversation: true, port: 0
    });
    const blocked = await post(server.address);
    assert.equal(blocked.status, 503);
    const body = await blocked.text();
    assert.match(body, /unavailable/);
    assert.doesNotMatch(body, /Forbidden cross-worker|credential|sk-r265/i);
    assert.equal(calls, 0, 'The second worker must never reach Luna or Terra');
    assert.equal((await thisWorker.inspectReadOnly()).requests, 0,
      'A competing dispatch must not reserve additional fake spend');

    const repeat = await post(server.address);
    assert.equal(repeat.status, 503, 'The failed worker must latch NO-START');
    assert.equal(calls, 0);
    const anonymous = await post(server.address, null);
    assert.equal(anonymous.status, 403);
    await server.close();
    assert.equal((await createFaiscaLocalReservationLedger(options).inspectReadOnly()).requests, 0);
    await assert.rejects(
      createFaiscaLocalReservationLedger(options).ready(),
      /operator review|uncertain/i
    );

    const entries = await readdir(directory);
    assert.ok(entries.includes('.faisca-provider-dispatch-inflight'));
    for (const file of entries) {
      const bytes = await readFile(join(directory, file), 'utf8');
      for (const forbidden of [question, token, key, 'Forbidden cross-worker']) {
        assert.equal(bytes.includes(forbidden), false,
          'No HTTP input, fake credential or provider exception may enter the durable ledger');
      }
    }
  } finally {
    await server?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

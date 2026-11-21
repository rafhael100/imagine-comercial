import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab } from '../ops/faisca/openai/live-lab.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const bearer = 'R195_SYNTHETIC_HTTP_TIMEOUT_BEARER_0123456789';
const fakeApiKey = 'sk-r195-fixture-no-real-provider-123456789';

async function post(server) {
  return fetch(server.address + server.path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
    body: '{"caseId":"compare"}'
  });
}

test('R195 server-only timeout durably blocks restart even if injected upstream ignores abort', async t => {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r195-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'ledger');
  await mkdir(directory, { mode: 0o700 });
  const ledger = () => createFaiscaLocalReservationLedger({
    directory, maxRequests: 6, maxBudgetUsd: 1
  });
  let initialDispatches = 0, restartDispatches = 0;
  const createLab = fetchImpl => createFaiscaOpenAILiveLab({
    enabled: true, apiKey: fakeApiKey, extendedPrivateSession: true,
    timeoutMs: 1000, maxRequests: 6, maxBudgetUsd: 1,
    reservationLedger: ledger(), fetchImpl
  });
  const server = await startFaiscaOpenAIPrivateReview({
    lab: createLab(() => {
      initialDispatches++;
      // Deliberately non-cooperative transport: HTTP independent deadline
      // wins before the provider adapter's own abort timer.
      return new Promise(() => {});
    }),
    reviewToken: bearer, providerDeadlineMs: 100
  });
  t.after(() => server.close());

  const startedAt = performance.now();
  const denied = await post(server);
  assert.equal(denied.status, 503);
  const payload = await denied.json();
  assert.equal(payload.status, 'unavailable');
  assert.doesNotMatch(JSON.stringify(payload), /sk-r195|R195_SYNTHETIC|ledger|timeoutMs|Bearer/i);
  assert.ok(performance.now() - startedAt < 3000);
  assert.equal(initialDispatches, 1);
  assert.equal(server.inspect().providerUnavailable, true);
  // The R194 server-side latch is awaited by orderly shutdown, before the
  // slower, ignored provider promise/abort completes.
  await server.close();
  assert.equal(await readFile(join(directory, '.faisca-provider-outcome-uncertain'), 'utf8'),
    'faisca.private-provider-outcome-uncertain.v1\n');
  assert.equal((await ledger().inspectReadOnly()).requests, 1);
  await assert.rejects(ledger().ready(), /operator reconciliation/);

  const restarted = await startFaiscaOpenAIPrivateReview({
    lab: createLab(async () => {
      restartDispatches++;
      throw new Error('a second provider call must never be attempted');
    }),
    reviewToken: bearer
  });
  t.after(() => restarted.close());
  for (let i = 0; i < 2; i++) {
    const response = await post(restarted);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).status, 'unavailable');
  }
  assert.equal(initialDispatches, 1);
  assert.equal(restartDispatches, 0);
  assert.equal((await ledger().inspectReadOnly()).requests, 1);
  assert.equal(restarted.inspect().liveBudget.calls, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaOpenAILiveLab } from '../ops/faisca/openai/live-lab.mjs';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'PRIVATE_R192_SYNTHETIC_RESTART_TOKEN_123456';
const apiKey = 'sk-synthetic-r192-never-a-real-secret-123456';

async function ask(server) {
  return fetch(server.address + server.path, {
    method: 'POST', redirect: 'error',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId: 'compare' })
  });
}
async function assertUnavailable(response) {
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  const payload = await response.json();
  assert.equal(payload.status, 'unavailable');
  assert.doesNotMatch(JSON.stringify(payload), /secret|token|ledger|directory|openai|apiKey|syntheticQuestion/i);
}

test('R192 private HTTP protects a new process from redispach after synthetic uncertain API outcome', async t => {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r192-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'ledger');
  await mkdir(directory, { mode: 0o700 });
  const ledger = () => createFaiscaLocalReservationLedger({
    directory, maxRequests: 4, maxBudgetUsd: 1
  });
  let providerDispatches = 0;
  const client = (fetchImpl) => createFaiscaOpenAILiveLab({
    enabled: true, apiKey, extendedPrivateSession: true,
    maxRequests: 4, maxBudgetUsd: 1,
    reservationLedger: ledger(), fetchImpl
  });
  const first = await startFaiscaOpenAIPrivateReview({
    lab: client(async () => {
      providerDispatches++;
      return new Response('synthetic upstream failure', { status: 503 });
    }), reviewToken: token
  });
  assert.match(first.address, /^http:\/\/127\.0\.0\.1:\d+$/);
  await assertUnavailable(await ask(first));
  assert.equal(first.inspect().providerUnavailable, true);
  await first.close();

  const before = await readFile(join(directory, 'faisca-reservations.json'), 'utf8');
  assert.equal(JSON.parse(before).requests, 1);
  const marker = await readFile(join(directory, '.faisca-provider-outcome-uncertain'), 'utf8');
  assert.equal(marker, 'faisca.private-provider-outcome-uncertain.v1\n');

  const restarted = await startFaiscaOpenAIPrivateReview({
    lab: client(async () => {
      providerDispatches++;
      throw new Error('New process must not dispatch to provider');
    }), reviewToken: token
  });
  t.after(() => restarted.close());
  await assertUnavailable(await ask(restarted));
  await assertUnavailable(await ask(restarted));
  assert.equal(restarted.inspect().providerUnavailable, true);
  assert.equal(restarted.inspect().liveBudget.calls, 0);
  assert.equal(providerDispatches, 1, 'Only the original synthetic transport is called');
  assert.equal(await readFile(join(directory, 'faisca-reservations.json'), 'utf8'), before,
    'Persistent quota is never reset or charged twice after restart');
  await assert.rejects(ledger().ready(), /operator reconciliation/);
});

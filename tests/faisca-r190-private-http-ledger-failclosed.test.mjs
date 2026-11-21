import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, link, lstat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaOpenAILiveLab } from '../ops/faisca/openai/live-lab.mjs';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'PRIVATE_R190_LOOPBACK_FIXTURE_TOKEN_123456';
const apiKey = 'sk-synthetic-r190-unused-not-real-key-123456';
function lab(reservationLedger, onFetch) {
  return createFaiscaOpenAILiveLab({
    enabled: true, apiKey, extendedPrivateSession: true,
    maxRequests: 3, maxBudgetUsd: 1, reservationLedger,
    fetchImpl: onFetch
  });
}
async function ask(server) {
  return fetch(server.address + server.path, {
    method: 'POST', redirect: 'error',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ caseId: 'compare' })
  });
}
async function assertUnavailable(response) {
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  const payload = await response.json();
  assert.equal(payload.status, 'unavailable');
  // First provider rejection includes a generic sentence; subsequent breaker
  // rejections intentionally disclose only status=unavailable.
  assert.deepEqual(Object.keys(payload).sort(), Object.hasOwn(payload, 'message')
    ? ['message', 'status'] : ['status']);
  if (Object.hasOwn(payload, 'message')) {
    assert.equal(payload.message, 'The private AI review could not confirm a safe response.');
  }
  assert.doesNotMatch(JSON.stringify(payload), /secret|ledger|directory|key|token|question|stack/i);
}

test('R190 HTTP fails closed after committed-but-unacknowledged ledger reserve, no retry/egress', async t => {
  let reservations = 0, dispatches = 0;
  const client = lab({
    async reserve() {
      reservations++;
      throw new Error('PRIVATE_LEDGER_SECRET_INTERNAL_PATH');
    }
  }, async () => { dispatches++; throw new Error('Unexpected provider egress'); });
  const server = await startFaiscaOpenAIPrivateReview({ lab: client, reviewToken: token });
  t.after(() => server.close());
  assert.match(server.address, /^http:\/\/127\.0\.0\.1:\d+$/);
  await assertUnavailable(await ask(server));
  await assertUnavailable(await ask(server));
  assert.equal(reservations, 1);
  assert.equal(dispatches, 0);
  assert.equal(server.inspect().providerUnavailable, true);
  assert.equal(server.inspect().liveBudget.calls, 0);
});

test('R190 real durable ledger hardlink returns generic HTTP 503 before any paid model dispatch', async t => {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r190-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'ledger');
  await mkdir(directory, { mode: 0o700 });
  const ledger = createFaiscaLocalReservationLedger({
    directory, maxRequests: 3, maxBudgetUsd: 1
  });
  assert.equal((await ledger.reserve(0.01)).requests, 1);
  await link(join(directory, 'faisca-reservations.json'), join(root, 'private-ledger-alias'));
  let dispatches = 0;
  const client = lab(ledger, async () => { dispatches++; throw new Error('Unexpected network'); });
  const server = await startFaiscaOpenAIPrivateReview({ lab: client, reviewToken: token });
  t.after(() => server.close());
  await assertUnavailable(await ask(server));
  await assertUnavailable(await ask(server));
  assert.equal(dispatches, 0);
  assert.equal(server.inspect().providerUnavailable, true);
  assert.equal(server.inspect().liveBudget.calls, 0);
  await lstat(join(directory, '.faisca-reservations.lock'));
});

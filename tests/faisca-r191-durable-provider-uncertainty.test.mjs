import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, lstat, readFile, rm, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';

const apiKey = 'sk-synthetic-r191-do-not-use-or-log-123456';
const MARKER = '.faisca-provider-outcome-uncertain';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r191-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'ledger');
  await mkdir(directory, { mode: 0o700 });
  return { root, directory, ledger: () => createFaiscaLocalReservationLedger({
    directory, maxRequests: 5, maxBudgetUsd: 1
  }) };
}
function lab(reservationLedger, fetchImpl) {
  return createFaiscaOpenAILiveLab({
    enabled: true, apiKey, extendedPrivateSession: true,
    maxRequests: 5, maxBudgetUsd: 1, reservationLedger, fetchImpl
  });
}
function lunaFallback() {
  return new Response(JSON.stringify({
    model: FAISCA_OPENAI_MODELS.classification, status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [
      { type: 'output_text', text: JSON.stringify({ answerId: 'none' }) }
    ] }],
    usage: { input_tokens: 30, output_tokens: 9 }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('R191 uncertain paid dispatch persists a NO-START gate across ledger and lab instances', async t => {
  const { directory, ledger } = await fixture(t);
  let dispatched = 0;
  const first = lab(ledger(), async () => {
    dispatched++;
    return new Response('synthetic provider error', { status: 503 });
  });
  await assert.rejects(first.answer('compare'), /OpenAI private test unavailable/);
  assert.equal(dispatched, 1);
  const marker = await lstat(join(directory, MARKER));
  assert.equal(marker.isFile(), true);
  assert.equal(marker.nlink, 1);
  assert.equal(marker.mode & 0o077, 0);
  assert.equal(await readFile(join(directory, MARKER), 'utf8'),
    'faisca.private-provider-outcome-uncertain.v1\n');
  await assert.rejects(ledger().ready(), /operator reconciliation/);
  const snapshot = await ledger().inspectReadOnly();
  assert.equal(snapshot.requests, 1, 'Offline reconciliation must remain possible');
  assert.equal(snapshot.providerUsageReconciled, false);
  assert.equal(snapshot.publicReady, false);

  const fresh = lab(ledger(), async () => {
    dispatched++;
    throw new Error('Second transport must not be reached');
  });
  await assert.rejects(fresh.answer('compare'), /OpenAI private test unavailable/);
  assert.equal(fresh.inspect().calls, 0);
  assert.equal(dispatched, 1, 'Restart must not send a second paid request');
  const state = JSON.parse(await readFile(join(directory, 'faisca-reservations.json'), 'utf8'));
  assert.equal(state.requests, 1, 'Durable spent reservation remains unchanged');
});

test('R191 healthy synthetic Luna completion does not create uncertainty marker', async t => {
  const { directory, ledger } = await fixture(t);
  let dispatched = 0;
  const first = lab(ledger(), async () => { dispatched++; return lunaFallback(); });
  assert.equal((await first.answer('compare')).status, 'unsupported');
  const second = lab(ledger(), async () => { dispatched++; return lunaFallback(); });
  assert.equal((await second.answer('process')).status, 'unsupported');
  assert.equal(dispatched, 2);
  assert.equal((await ledger().inspectReadOnly()).requests, 2);
  await assert.rejects(lstat(join(directory, MARKER)), { code: 'ENOENT' });
});

test('R191 repeated halt is idempotent, malformed or symlinked marker fails closed', async t => {
  const { root, directory, ledger } = await fixture(t);
  assert.equal(await ledger().markOutcomeUncertain(), true);
  assert.equal(await ledger().markOutcomeUncertain(), true);
  await unlink(join(directory, MARKER));
  await symlink(join(root, 'untrusted-target'), join(directory, MARKER));
  await assert.rejects(ledger().ready(), /operator reconciliation/);
  await assert.rejects(ledger().reserve(0.01), /operator reconciliation/);
  assert.equal((await ledger().inspectReadOnly()).requests, 0,
    'A hostile marker blocks dispatch but not read-only accounting');
});

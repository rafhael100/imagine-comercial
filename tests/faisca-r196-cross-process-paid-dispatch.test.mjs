import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, lstat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab } from '../ops/faisca/openai/live-lab.mjs';

const dispatchMarker = '.faisca-provider-dispatch-inflight';

async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r196-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'ledger');
  await mkdir(directory, { mode: 0o700 });
  return { directory, make: () => createFaiscaLocalReservationLedger({
    directory, maxRequests: 6, maxBudgetUsd: 1
  }) };
}

test('R196 live lock serializes independent ledger instances without consuming quota', async t => {
  const { directory, make } = await setup(t);
  const owner = make(), competing = make();
  assert.equal(await owner.beginPaidDispatch(), true);
  assert.equal(await readFile(join(directory, dispatchMarker), 'utf8'),
    'faisca.private-provider-dispatch-inflight.v1\n');
  assert.equal((await lstat(join(directory, dispatchMarker))).nlink, 1);
  await assert.rejects(competing.ready(), /operator review/);
  await assert.rejects(competing.reserve(0.01), /operator review/);
  await assert.rejects(competing.beginPaidDispatch(), /unavailable/);
  await assert.rejects(competing.completePaidDispatch(), /not owned/);
  assert.equal((await owner.inspectReadOnly()).requests, 0);
  assert.equal(await owner.completePaidDispatch(), true);
  assert.equal(await competing.ready(), true);
  assert.equal((await competing.inspectReadOnly()).requests, 0);
});

test('R196 process termination leaves durable no-start marker until explicit human review', async t => {
  const { directory, make } = await setup(t);
  const moduleUrl = new URL('../ops/faisca/openai/durable-reservation-ledger.mjs', import.meta.url).href;
  const source = `const { createFaiscaLocalReservationLedger } = await import(process.argv[1]);
await createFaiscaLocalReservationLedger({
 directory: process.argv[2], maxRequests: 6, maxBudgetUsd: 1
}).beginPaidDispatch();`;
  execFileSync(process.execPath, ['--input-type=module', '-e', source, moduleUrl, directory],
    { timeout: 5000, stdio: 'pipe' });
  assert.equal(await readFile(join(directory, dispatchMarker), 'utf8'),
    'faisca.private-provider-dispatch-inflight.v1\n');
  const fresh = make();
  await assert.rejects(fresh.ready(), /operator review/);
  await assert.rejects(fresh.reserve(0.01), /operator review/);
  await assert.rejects(fresh.beginPaidDispatch(), /unavailable/);
  await assert.rejects(fresh.completePaidDispatch(), /not owned/);
  assert.equal((await fresh.inspectReadOnly()).requests, 0);
});

test('R196 never sends a provider request when another process owns the dispatch marker', async t => {
  const { make } = await setup(t);
  const owner = make();
  assert.equal(await owner.beginPaidDispatch(), true);
  let sent = 0;
  const lab = createFaiscaOpenAILiveLab({
    enabled: true, apiKey: 'sk-r196-fixture-not-a-real-key-12345',
    extendedPrivateSession: true, timeoutMs: 1000,
    maxBudgetUsd: 1, maxRequests: 6, reservationLedger: make(),
    fetchImpl: async () => { sent++; throw Error('must never reach provider'); }
  });
  await assert.rejects(lab.answer('compare'), /OpenAI private test unavailable/);
  assert.equal(sent, 0);
  assert.equal(lab.inspect().calls, 0);
  assert.equal((await make().inspectReadOnly()).requests, 0);
  // Only the original owner may release the marker. The failed fixture did
  // not consume an API request or mutate the accounting state.
  assert.equal(await owner.completePaidDispatch(), true);
});

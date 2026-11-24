import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, chmod, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { createFaiscaOpenAILiveLab } from '../ops/faisca/openai/live-lab.mjs';

const key = 'sk-private-synthetic-test-not-real-123456';
async function directoryFixture(fn) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r82-'));
  await chmod(directory, 0o700);
  try { return await fn(directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
function fakeResponse(payload) {
  return new Response(JSON.stringify({
    model: 'gpt-6-luna',
    status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [
      { type: 'output_text', text: JSON.stringify(payload) }
    ] }],
    usage: { input_tokens: 20, output_tokens: 10 }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('R82 persists reservations across fresh workers and refuses a third paid call', async () => {
  await directoryFixture(async directory => {
    const a = createFaiscaLocalReservationLedger({ directory, maxRequests: 2, maxBudgetUsd: 1 });
    const b = createFaiscaLocalReservationLedger({ directory, maxRequests: 2, maxBudgetUsd: 1 });
    assert.equal(await a.ready(), true);
    assert.equal((await a.reserve(0.20)).requests, 1);
    assert.equal((await b.reserve(0.30)).requests, 2);
    await assert.rejects(a.reserve(0.01), /limit reached/);
    const state = JSON.parse(await readFile(join(directory, 'faisca-reservations.json'), 'utf8'));
    assert.equal(state.requests, 2);
    assert.equal(state.reservedMicros, 500000);
    assert.equal(state.limitMicros, 1000000);
    assert.equal(state.schema, 'faisca.private-local-reservations.v1');
    assert.deepEqual(Object.keys(state).sort(),
      ['schema', 'requests', 'reservedMicros', 'limitRequests', 'limitMicros'].sort());
  });
});

test('R82 budget is durable and cannot be enlarged on restart with a different policy', async () => {
  await directoryFixture(async directory => {
    const a = createFaiscaLocalReservationLedger({ directory, maxRequests: 100, maxBudgetUsd: 0.5 });
    await a.reserve(0.4);
    await assert.rejects(a.reserve(0.11), /limit reached/);
    const changed = createFaiscaLocalReservationLedger({ directory, maxRequests: 100, maxBudgetUsd: 10 });
    await assert.rejects(changed.reserve(0.01), /operator review/);
    const state = JSON.parse(await readFile(join(directory, 'faisca-reservations.json'), 'utf8'));
    assert.equal(state.requests, 1, 'Denied reservations must not consume more calls.');
  });
});

test('R82 refuses insecure directories, symlink directories, corrupted files, and leftover locks', async () => {
  await directoryFixture(async directory => {
    const ledger = createFaiscaLocalReservationLedger({ directory, maxRequests: 2, maxBudgetUsd: 1 });
    await chmod(directory, 0o755);
    await assert.rejects(ledger.reserve(0.1), /mode 0700/);
    await chmod(directory, 0o700);
    const alias = directory + '-link';
    await symlink(directory, alias);
    try {
      await assert.rejects(
        createFaiscaLocalReservationLedger({ directory: alias }).ready(), /real and mode 0700/
      );
    } finally { await rm(alias, { force: true }); }
    await writeFile(join(directory, '.faisca-reservations.lock'), 'crashed', { mode: 0o600 });
    await assert.rejects(ledger.reserve(0.1), /busy or unavailable/);
    await rm(join(directory, '.faisca-reservations.lock'));
    await writeFile(join(directory, 'faisca-reservations.json'), '{"oops":true}', { mode: 0o600 });
    await assert.rejects(ledger.reserve(0.1), /operator review/);
  });
});

test('R82 simultaneous processes cannot both reserve the final slot; no invisible retries', async () => {
  await directoryFixture(async directory => {
    const a = createFaiscaLocalReservationLedger({ directory, maxRequests: 1, maxBudgetUsd: 1 });
    const b = createFaiscaLocalReservationLedger({ directory, maxRequests: 1, maxBudgetUsd: 1 });
    const outcomes = await Promise.allSettled([a.reserve(0.4), b.reserve(0.4)]);
    assert.equal(outcomes.filter(value => value.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(value => value.status === 'rejected').length, 1);
    const state = JSON.parse(await readFile(join(directory, 'faisca-reservations.json'), 'utf8'));
    assert.equal(state.requests, 1);
    assert.equal(state.reservedMicros, 400000);
  });
});

test('R82 private OpenAI lab reserves BEFORE dispatch and preserves reservation on API error', async () => {
  await directoryFixture(async directory => {
    let dispatched = 0;
    const ledger = createFaiscaLocalReservationLedger({ directory, maxRequests: 1, maxBudgetUsd: 1 });
    const lab = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: key, extendedPrivateSession: true,
      maxRequests: 100, maxBudgetUsd: 10, reservationLedger: ledger,
      fetchImpl: async () => {
        dispatched++;
        return new Response('unavailable', { status: 503 });
      }
    });
    await assert.rejects(lab.answer('compare'), /private test unavailable/);
    assert.equal(dispatched, 1);
    assert.equal(lab.inspect().localDurableReservations, true);
    const restarted = createFaiscaOpenAILiveLab({
      enabled: true, apiKey: key, extendedPrivateSession: true,
      maxRequests: 100, maxBudgetUsd: 10,
      reservationLedger: createFaiscaLocalReservationLedger({
        directory, maxRequests: 1, maxBudgetUsd: 1
      }),
      fetchImpl: async () => { dispatched++; return fakeResponse({ answerId: 'none' }); }
    });
    // R188 suppresses internal durable-ledger errors to avoid exposing private paths.
    // A failed reservation (including quota denial) is now fail-closed and generic.
    await assert.rejects(restarted.answer('compare'), /OpenAI private test unavailable/);
    assert.equal(dispatched, 1, 'No second API call after process restart.');
  });
});

test('R332 nonblocking ledger reads reject FIFO corruption without hanging preflight or reservation', { skip: process.platform === 'win32' }, async () => {
  const moduleUrl = new URL('../ops/faisca/openai/durable-reservation-ledger.mjs', import.meta.url).href;
  for (const name of [
    'faisca-reservations.json', '.faisca-reservations-initialized',
    '.faisca-reservations-highwater.json', '.faisca-reservations-highwater-initialized'
  ]) {
    await directoryFixture(async directory => {
      const ledger = createFaiscaLocalReservationLedger({ directory, maxRequests: 4, maxBudgetUsd: 1 });
      await ledger.reserve(0.1);
      const path = join(directory, name);
      await rm(path);
      execFileSync('mkfifo', ['-m', '600', path]);
      // Bound the subprocess itself, not merely a JS timer: a blocking native
      // open would otherwise keep libuv alive after a rejected test.
      execFileSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import { createFaiscaLocalReservationLedger } from ${JSON.stringify(moduleUrl)};
        const ledger = createFaiscaLocalReservationLedger({
          directory: ${JSON.stringify(directory)}, maxRequests: 4, maxBudgetUsd: 1
        });
        await assert.rejects(ledger.ready());
        await assert.rejects(ledger.inspectReadOnly());
        await assert.rejects(ledger.reserve(0.1));
      `], { timeout: 5000, killSignal: 'SIGKILL' });
    });
  }
});

test('R332 a FIFO replacing an owned dispatch marker never stalls egress validation or releases the marker', { skip: process.platform === 'win32' }, async () => {
  const moduleUrl = new URL('../ops/faisca/openai/durable-reservation-ledger.mjs', import.meta.url).href;
  await directoryFixture(async directory => {
    execFileSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { execFileSync } from 'node:child_process';
      import { rm, lstat } from 'node:fs/promises';
      import { join } from 'node:path';
      import { createFaiscaLocalReservationLedger } from ${JSON.stringify(moduleUrl)};
      const directory = ${JSON.stringify(directory)};
      const ledger = createFaiscaLocalReservationLedger({ directory });
      await ledger.reserve(0.1);
      await ledger.beginPaidDispatch();
      const path = join(directory, '.faisca-provider-dispatch-inflight');
      await rm(path);
      execFileSync('mkfifo', ['-m', '600', path]);
      await assert.rejects(ledger.assertPaidDispatchStillValid(), /operator review/);
      await assert.rejects(ledger.completePaidDispatch(), /operator review/);
      assert.equal((await lstat(path)).isFIFO(), true);
    `], { timeout: 5000, killSignal: 'SIGKILL' });
  });
});

test('R333 the paid marker cannot authorize dispatch without a durable reservation', async () => {
  await directoryFixture(async directory => {
    const ledger = createFaiscaLocalReservationLedger({ directory });
    await assert.rejects(ledger.beginPaidDispatch(), /reservation missing/);
    await assert.rejects(ledger.completePaidDispatch(), /reservation missing/);
    assert.equal(await readFile(join(directory, '.faisca-provider-dispatch-inflight'), 'utf8'),
      'faisca.private-provider-dispatch-inflight.v1\n');
    await assert.rejects(createFaiscaLocalReservationLedger({ directory }).ready(), /in flight/);
  });
});

test('R333 corruption or an unfinished reservation fences provider reuse, HTTP egress and acknowledgment', async () => {
  for (const corruption of ['state', 'witness', 'lock']) {
    await directoryFixture(async directory => {
      const ledger = createFaiscaLocalReservationLedger({ directory });
      await ledger.reserve(0.1);
      await ledger.beginPaidDispatch();
      assert.equal(await ledger.assertPaidDispatchStillValid(), true);
      if (corruption === 'state') {
        await rm(join(directory, 'faisca-reservations.json'));
      } else if (corruption === 'witness') {
        const path = join(directory, '.faisca-reservations-highwater.json');
        const witness = JSON.parse(await readFile(path, 'utf8'));
        await writeFile(path, JSON.stringify({ ...witness, requests: 0 }) + '\n');
      } else {
        await writeFile(join(directory, '.faisca-reservations.lock'), '', { mode: 0o600 });
      }
      await assert.rejects(ledger.beginPaidDispatch(), /operator review/);
      await assert.rejects(ledger.assertPaidDispatchStillValid(), /operator review/);
      await assert.rejects(ledger.completePaidDispatch(), /operator review/);
      assert.equal(await readFile(join(directory, '.faisca-provider-dispatch-inflight'), 'utf8'),
        'faisca.private-provider-dispatch-inflight.v1\n');
      await assert.rejects(createFaiscaLocalReservationLedger({ directory }).ready(), /in flight/);
    });
  }
});

test('R333 successful two-call reservation retains the normal dispatch and acknowledgment path', async () => {
  await directoryFixture(async directory => {
    const ledger = createFaiscaLocalReservationLedger({ directory });
    await ledger.reserve(0.1);
    assert.equal(await ledger.beginPaidDispatch(), true);
    await ledger.reserve(0.2);
    assert.equal(await ledger.beginPaidDispatch(), true);
    assert.equal(await ledger.assertPaidDispatchStillValid(), true);
    assert.equal(await ledger.completePaidDispatch(), true);
    const snapshot = await ledger.inspectReadOnly();
    assert.equal(snapshot.requests, 2);
    assert.equal(snapshot.reservedMicros, 300000);
    assert.equal(await ledger.ready(), true);
  });
});

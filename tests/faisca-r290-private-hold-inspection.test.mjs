import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, lstat, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import {
  inspectFaiscaLocalPrivateHoldsReadOnly, FAISCA_HOLD_INSPECTION_SCHEMA
} from '../ops/faisca/openai/private-ledger-hold-inspection.mjs';

const script = fileURLToPath(new URL('../scripts/faisca-private-hold-review.mjs', import.meta.url));
function childRun(directory, enabled = true, ci = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, '--directory=' + directory], {
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 8000,
      env: {
        NODE_ENV: 'test',
        ...(enabled ? { FAISCA_PRIVATE_HOLD_INSPECTION: 'REVIEW_ONLY' } : {}),
        ...(ci ? { GITHUB_ACTIONS: 'true' } : {})
      }
    });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', x => { stdout += x; });
    child.stderr.on('data', x => { stderr += x; });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

test('R290 immutable ledger and conservative NO-START observations in an isolated private directory',
  { timeout: 16000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r290-'));
  await chmod(directory, 0o700);
  try {
    const ledger = createFaiscaLocalReservationLedger({
      directory, maxRequests: 4, maxBudgetUsd: 1
    });
    await ledger.reserve(0.001);
    await ledger.reserve(0.002);
    const beforeFiles = (await readdir(directory)).sort();
    const beforeBytes = await Promise.all(beforeFiles.map(name => readFile(join(directory, name))));
    const clear = await inspectFaiscaLocalPrivateHoldsReadOnly({ directory });
    assert.equal(Object.isFrozen(clear), true);
    assert.equal(clear.schema, FAISCA_HOLD_INSPECTION_SCHEMA);
    assert.equal(clear.holdObserved, false);
    assert.equal(clear.canStartPaidCalls, false);
    assert.equal(clear.canReleaseDurableFence, false);
    assert.equal(clear.canResetQuota, false);
    assert.equal(clear.publicReady, false);
    assert.equal(clear.providerUsageReconciled, false);
    assert.equal(clear.observationAtomicAcrossProcesses, false);

    const lock = join(directory, '.faisca-reservations.lock');
    const dispatch = join(directory, '.faisca-provider-dispatch-inflight');
    const uncertain = join(directory, '.faisca-provider-outcome-uncertain');
    await writeFile(lock, 'synthetic-lock\n', { mode: 0o600 });
    let view = await childRun(directory);
    assert.equal(view.code, 0);
    let payload = JSON.parse(view.stdout);
    assert.equal(payload.reservationLockPresent, true);
    assert.equal(payload.providerDispatchPresent, false);
    assert.equal(payload.providerOutcomeUncertainPresent, false);
    assert.equal(payload.holdObserved, true);
    assert.equal(payload.canStartPaidCalls, false);
    assert.equal(view.stderr, '');
    assert.equal(view.stdout.includes(directory), false);
    await rm(lock);

    // Even a dangling symlink must be considered a dispatch HOLD, without
    // following its target or deleting it.
    await symlink('nonexistent-synthetic-target', dispatch);
    view = await childRun(directory);
    assert.equal(view.code, 0);
    payload = JSON.parse(view.stdout);
    assert.equal(payload.providerDispatchPresent, true);
    assert.equal(payload.holdObserved, true);
    assert.equal((await lstat(dispatch)).isSymbolicLink(), true);
    await rm(dispatch);
    await writeFile(uncertain, 'synthetic-uncertain\n', { mode: 0o600 });
    view = await childRun(directory);
    assert.equal(view.code, 0);
    payload = JSON.parse(view.stdout);
    assert.equal(payload.providerOutcomeUncertainPresent, true);
    assert.equal(payload.canReleaseDurableFence, false);
    await rm(uncertain);

    const unchanged = (await readdir(directory)).sort();
    assert.deepEqual(unchanged, beforeFiles);
    const afterBytes = await Promise.all(unchanged.map(name => readFile(join(directory, name))));
    for (let i = 0; i < unchanged.length; i++) {
      assert.deepEqual(afterBytes[i], beforeBytes[i]);
    }
    assert.equal((await ledger.inspectReadOnly()).requests, 2);

    for (const flags of [[false, false], [true, true]]) {
      const denied = await childRun(directory, ...flags);
      assert.equal(denied.code, 1);
      assert.equal(denied.stdout, '');
      assert.equal(denied.stderr, 'Private hold inspection unavailable; manual review required.\n');
    }
    await chmod(directory, 0o755);
    const unsafe = await childRun(directory);
    assert.equal(unsafe.code, 1);
    assert.equal(unsafe.stdout, '');
    assert.equal(unsafe.stderr.includes(directory), false);
  } finally {
    await chmod(directory, 0o700).catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});

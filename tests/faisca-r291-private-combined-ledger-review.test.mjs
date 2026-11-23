import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import {
  reviewFaiscaPrivateLocalLedgerAndHolds, FAISCA_COMBINED_LEDGER_REVIEW_SCHEMA
} from '../ops/faisca/openai/private-ledger-combined-review.mjs';

const cli = fileURLToPath(new URL('../scripts/faisca-private-combined-ledger-review.mjs', import.meta.url));
function invoke(directory, { enabled = true, ci = false } = {}) {
  return new Promise((resolve, reject) => {
    const args = [cli, '--directory=' + directory, '--max-requests=4', '--max-budget-usd=1'];
    const child = spawn(process.execPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 8000,
      env: {
        NODE_ENV: 'test',
        ...(enabled ? { FAISCA_PRIVATE_LEDGER_COMBINED_REVIEW: 'REVIEW_ONLY' } : {}),
        ...(ci ? { GITHUB_ACTIONS: 'true' } : {})
      }
    });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', value => { stdout += value; });
    child.stderr.on('data', value => { stderr += value; });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

test('R291 combines durable reservations and provider holds without write, unlock, or readiness claim',
  { timeout: 20000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'faisca-r291-'));
    await chmod(directory, 0o700);
    try {
      const ledger = createFaiscaLocalReservationLedger({
        directory, maxRequests: 4, maxBudgetUsd: 1
      });
      const empty = await reviewFaiscaPrivateLocalLedgerAndHolds({
        directory, maxRequests: 4, maxBudgetUsd: 1
      });
      assert.equal(empty.ledgerReviewStatus, 'uninitialized_or_legacy_requires_review');
      assert.equal(empty.reservedRequests, null);
      assert.equal(empty.canStartPaidCalls, false);
      assert.equal(empty.stagingInstallationVerified, false);

      await ledger.reserve(0.001);
      await ledger.reserve(0.002);
      const beforeNames = (await readdir(directory)).sort();
      const beforeData = await Promise.all(beforeNames.map(name => readFile(join(directory, name))));

      const good = await invoke(directory);
      assert.equal(good.code, 0, good.stderr);
      assert.equal(good.stderr, '');
      assert.equal(good.stdout.includes(directory), false);
      const report = JSON.parse(good.stdout);
      assert.equal(report.schema, FAISCA_COMBINED_LEDGER_REVIEW_SCHEMA);
      assert.equal(report.ledgerReviewStatus, 'readable_non_atomic');
      assert.equal(report.reservedRequests, 2);
      assert.equal(report.reservedMicros, 3000);
      assert.equal(report.holdObserved, false);
      for (const field of [
        'snapshotAtomicAcrossProcesses', 'stagingInstallationVerified',
        'providerUsageReconciled', 'canStartPaidCalls',
        'canReleaseDurableFence', 'canResetQuota',
        'publicReady', 'operationalEffects'
      ]) assert.equal(report[field], false);
      assert.equal(Object.isFrozen(await reviewFaiscaPrivateLocalLedgerAndHolds({
        directory, maxRequests: 4, maxBudgetUsd: 1
      })), true);
      assert.deepEqual((await readdir(directory)).sort(), beforeNames);
      const afterData = await Promise.all(beforeNames.map(name => readFile(join(directory, name))));
      for (let i = 0; i < beforeData.length; i++) {
        assert.deepEqual(afterData[i], beforeData[i]);
      }

      const dispatch = join(directory, '.faisca-provider-dispatch-inflight');
      await symlink('missing-synthetic-target', dispatch);
      const pending = await reviewFaiscaPrivateLocalLedgerAndHolds({
        directory, maxRequests: 4, maxBudgetUsd: 1
      });
      assert.equal(pending.providerDispatchPresent, true);
      assert.equal(pending.holdObserved, true);
      assert.equal(pending.canStartPaidCalls, false);
      await rm(dispatch);

      const lock = join(directory, '.faisca-reservations.lock');
      await writeFile(lock, 'synthetic-crashed-lock\n', { mode: 0o600 });
      const locked = JSON.parse((await invoke(directory)).stdout);
      assert.equal(locked.reservationLockPresent, true);
      assert.equal(locked.ledgerReviewStatus, 'manual_review_required');
      assert.equal(locked.reservedRequests, null);
      assert.equal(locked.canReleaseDurableFence, false);
      await rm(lock);

      // An invalid high-water file must never be reported as zero usage.
      await writeFile(join(directory, '.faisca-reservations-highwater.json'),
        'synthetic-invalid-highwater\n');
      const corrupt = JSON.parse((await invoke(directory)).stdout);
      assert.equal(corrupt.ledgerReviewStatus, 'manual_review_required');
      assert.equal(corrupt.reservedMicros, null);
      assert.equal(corrupt.publicReady, false);

      for (const config of [{ enabled: false }, { ci: true }]) {
        const denied = await invoke(directory, config);
        assert.equal(denied.code, 1);
        assert.equal(denied.stdout, '');
        assert.equal(denied.stderr.includes(directory), false);
      }
      await chmod(directory, 0o755);
      const unsafe = await invoke(directory);
      assert.equal(unsafe.code, 1);
      assert.equal(unsafe.stdout, '');
      assert.equal(unsafe.stderr.includes(directory), false);
    } finally {
      await chmod(directory, 0o700).catch(() => {});
      await rm(directory, { recursive: true, force: true });
    }
  });

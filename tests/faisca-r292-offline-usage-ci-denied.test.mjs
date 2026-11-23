import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

const cli = fileURLToPath(new URL('../scripts/faisca-private-usage-review.mjs', import.meta.url));
const input = '{"schema":"faisca.operator-entered-usage-aggregate.v1","requestCount":1,"billedMicros":1000}\n';

function execReview(directory, ciFlags) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli,
      '--directory=' + directory, '--max-requests=4', '--max-budget-usd=1'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 8000,
      env: {
        NODE_ENV: 'test',
        FAISCA_PRIVATE_OPERATOR_USAGE_REVIEW: 'REVIEW_ONLY',
        ...ciFlags
      }
    });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

test('R292 offline review rejects CI and GitHub Actions even when REVIEW_ONLY is set, without modifying durable ledger',
  { timeout: 16000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'faisca-r292-'));
    await chmod(directory, 0o700);
    try {
      const ledger = createFaiscaLocalReservationLedger({
        directory, maxRequests: 4, maxBudgetUsd: 1
      });
      await ledger.reserve(0.001);
      const names = (await readdir(directory)).sort();
      const before = await Promise.all(names.map(name => readFile(join(directory, name))));
      for (const flags of [
        { CI: 'true' },
        { GITHUB_ACTIONS: 'true' },
        { CI: 'true', GITHUB_ACTIONS: 'true' }
      ]) {
        const blocked = await execReview(directory, flags);
        assert.equal(blocked.code, 1);
        assert.equal(blocked.stdout, '');
        assert.equal(blocked.stderr,
          'Private usage comparison unavailable; manual review required.\n');
        assert.equal(blocked.stderr.includes(directory), false);
        assert.equal(blocked.stderr.includes(input.trim()), false);
      }
      // Normal isolated invocation still works for a fictitious aggregate.
      const allowed = await execReview(directory, {});
      assert.equal(allowed.code, 0, allowed.stderr);
      const report = JSON.parse(allowed.stdout);
      assert.equal(report.reservedRequests, 1);
      assert.equal(report.operatorEnteredProviderRequests, 1);
      assert.equal(report.providerUsageReconciled, false);
      assert.equal(report.canReleaseDurableFence, false);
      assert.equal(report.publicReady, false);
      assert.deepEqual((await readdir(directory)).sort(), names);
      const after = await Promise.all(names.map(name => readFile(join(directory, name))));
      for (let i = 0; i < names.length; i++) assert.deepEqual(after[i], before[i]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

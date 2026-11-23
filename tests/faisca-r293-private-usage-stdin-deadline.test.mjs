import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

const cli = fileURLToPath(new URL('../scripts/faisca-private-usage-review.mjs', import.meta.url));

function invokeWithNeverEndingPipe(directory, partial = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      cli, '--directory=' + directory, '--max-requests=4', '--max-budget-usd=1'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
      env: {
        NODE_ENV: 'test',
        FAISCA_PRIVATE_OPERATOR_USAGE_REVIEW: 'REVIEW_ONLY'
      }
    });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.stdin.on('error', () => {}); // timed-out reader closes its end first
    if (partial) child.stdin.write(partial);
    // Deliberately DO NOT end stdin: this was previously an unlimited wait.
    child.once('close', (exitCode, signal) => {
      child.stdin.destroy();
      resolve({ exitCode, signal, stdout, stderr });
    });
  });
}

test('R293 finite operator stdin deadline denies EOF-less and incomplete aggregates before ledger access',
  { timeout: 18000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'faisca-r293-'));
    await chmod(directory, 0o700);
    try {
      const ledger = createFaiscaLocalReservationLedger({
        directory, maxRequests: 4, maxBudgetUsd: 1
      });
      await ledger.reserve(0.001);
      const names = (await readdir(directory)).sort();
      const before = await Promise.all(names.map(name => readFile(join(directory, name))));
      for (const partial of [
        '',
        '{"schema":"faisca.operator-entered-usage-aggregate.v1","requestCount":'
      ]) {
        const outcome = await invokeWithNeverEndingPipe(directory, partial);
        assert.equal(outcome.signal, null, 'CLI must exit by its own deadline');
        assert.equal(outcome.exitCode, 1);
        assert.equal(outcome.stdout, '');
        assert.equal(outcome.stderr,
          'Private usage comparison unavailable; manual review required.\n');
        assert.equal(outcome.stderr.includes(directory), false);
        if (partial) assert.equal(outcome.stderr.includes(partial), false);
      }
      assert.deepEqual((await readdir(directory)).sort(), names);
      const after = await Promise.all(names.map(name => readFile(join(directory, name))));
      for (let i = 0; i < names.length; i++) assert.deepEqual(after[i], before[i]);
      assert.equal((await ledger.inspectReadOnly()).requests, 1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

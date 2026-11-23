import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

const script = fileURLToPath(new URL('../scripts/faisca-private-usage-review.mjs', import.meta.url));
const canonical = '{"schema":"faisca.operator-entered-usage-aggregate.v1","requestCount":2,"billedMicros":1200}';
function execute(flags, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...flags], {
      env: { NODE_ENV: 'test', FAISCA_PRIVATE_OPERATOR_USAGE_REVIEW: 'REVIEW_ONLY' },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 8000
    });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

test('R289 canonical input is accepted; ambiguous duplicate keys, aliases and delimiters are rejected before inspecting the ledger', 
  { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r289-'));
  await chmod(directory, 0o700);
  const flags = ['--directory=' + directory, '--max-requests=4', '--max-budget-usd=1'];
  try {
    const ledger = createFaiscaLocalReservationLedger({
      directory, maxRequests: 4, maxBudgetUsd: 1
    });
    await ledger.reserve(0.001);
    await ledger.reserve(0.002);
    const names = (await readdir(directory)).sort();
    const before = await Promise.all(names.map(name => readFile(join(directory, name))));
    for (const allowed of [canonical, canonical + '\n']) {
      const result = await execute(flags, allowed);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.stderr, '');
      const report = JSON.parse(result.stdout);
      assert.equal(report.reservedRequests, 2);
      assert.equal(report.operatorEnteredProviderRequests, 2);
      assert.equal(report.operatorEnteredBilledMicros, 1200);
      assert.equal(report.providerUsageReconciled, false);
      assert.equal(report.canReleaseDurableFence, false);
      assert.equal(report.publicReady, false);
    }
    // JSON.parse alone silently discards the first duplicate key. Even when
    // the final numeric value is plausible, human-visible ambiguity is a HOLD.
    const blocked = [
      '{"schema":"faisca.operator-entered-usage-aggregate.v1","requestCount":999,"requestCount":2,"billedMicros":1200}',
      '{"schema":"fake","schema":"faisca.operator-entered-usage-aggregate.v1","requestCount":2,"billedMicros":1200}',
      '{"schema":"faisca.operator-entered-usage-aggregate.v1","requestCount":2,"billedMicros":7000000,"billedMicros":1200}',
      '{ "schema":"faisca.operator-entered-usage-aggregate.v1","requestCount":2,"billedMicros":1200}',
      '{"schema":"faisca.operator-entered-usage-aggregate.v1","requestCount":2,"billedMicros":1.2e3}',
      '{"schema":"faisca.operator-entered-usage-aggregate.v1","requestCount":2,"billedMicros":1200}\r\n',
      canonical + '\n\n',
      '\ufeff' + canonical,
      canonical.replace('faisca.operator', 'faisca.\\u006fperator')
    ];
    for (const input of blocked) {
      const result = await execute(flags, input);
      assert.equal(result.code, 1, JSON.stringify(input));
      assert.equal(result.signal, null);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, 'Private usage comparison unavailable; manual review required.\n');
      assert.equal(result.stderr.includes(directory), false);
      assert.equal(result.stderr.includes(input), false);
    }
    assert.deepEqual((await readdir(directory)).sort(), names);
    const after = await Promise.all(names.map(name => readFile(join(directory, name))));
    for (let i = 0; i < before.length; i++) {
      assert.deepEqual(after[i], before[i]);
    }
    assert.equal((await ledger.inspectReadOnly()).requests, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

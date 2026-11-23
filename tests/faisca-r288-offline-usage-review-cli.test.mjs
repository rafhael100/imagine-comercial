import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

const cli = fileURLToPath(new URL('../scripts/faisca-private-usage-review.mjs', import.meta.url));
const valid = JSON.stringify({
  schema: 'faisca.operator-entered-usage-aggregate.v1',
  requestCount: 2,
  billedMicros: 1200
});

function invoke(args, input, authorized = true) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        NODE_ENV: 'test',
        ...(authorized ? { FAISCA_PRIVATE_OPERATOR_USAGE_REVIEW: 'REVIEW_ONLY' } : {})
      }
    });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => resolve({ code, stdout, stderr }));
    child.stdin.on('error', () => {}); // A fail-closed CLI may exit before stdin ends.
    child.stdin.end(input);
  });
}

test('R288 subprocess compares real local reservations without changing any durable file', 
  { timeout: 12000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r288-'));
  await chmod(directory, 0o700);
  const flags = ['--directory=' + directory, '--max-requests=4', '--max-budget-usd=1'];
  try {
    const ledger = createFaiscaLocalReservationLedger({
      directory, maxRequests: 4, maxBudgetUsd: 1
    });
    await ledger.reserve(0.001);
    await ledger.reserve(0.002);
    const names = (await readdir(directory)).sort();
    const previous = await Promise.all(names.map(name => readFile(join(directory, name))));
    const result = await invoke(flags, valid);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, '');
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.reviewStatus, 'manual_verification_required');
    assert.equal(payload.reservedMicros, 3000);
    assert.equal(payload.operatorEnteredBilledMicros, 1200);
    assert.equal(payload.providerUsageReconciled, false);
    assert.equal(payload.sourceVerifiedIndependently, false);
    assert.equal(payload.canReleaseDurableFence, false);
    assert.equal(payload.canResetQuota, false);
    assert.equal(payload.publicReady, false);
    assert.equal(payload.operationalEffects, false);
    assert.equal(result.stdout.includes(directory), false);
    assert.equal((await ledger.inspectReadOnly()).requests, 2);
    assert.deepEqual((await readdir(directory)).sort(), names);
    const after = await Promise.all(names.map(name => readFile(join(directory, name))));
    for (let i = 0; i < names.length; i++) assert.deepEqual(after[i], previous[i]);
    const withoutPermission = await invoke(flags, valid, false);
    assert.equal(withoutPermission.code, 1);
    assert.equal(withoutPermission.stdout, '');
    assert.match(withoutPermission.stderr, /manual review required/);
    for (const blocked of [
      '{"schema":"faisca.operator-entered-usage-aggregate.v1","requestCount":2,"billedMicros":1200,"apiKey":"sk-not-real-secret"}',
      '{"schema":"faisca.operator-entered-usage-aggregate.v1","requestCount":2,"billedMicros":1200,"customerEmail":"fiction@example.invalid"}',
      '{"schema":"faisca.operator-entered-usage-aggregate.v1","requestCount":2,"billedMicros":1.5}',
      'not-json'
    ]) {
      const rejected = await invoke(flags, blocked);
      assert.equal(rejected.code, 1);
      assert.equal(rejected.stdout, '');
      assert.equal(rejected.stderr.includes(blocked), false);
      assert.equal(rejected.stderr.includes(directory), false);
    }
    for (const badFlags of [
      [...flags, '--extra=1'],
      [flags[0], flags[1], flags[1]],
      [flags[0], '--max-requests=-1', flags[2]],
      [flags[0], flags[1], '--max-budget-usd=Infinity']
    ]) {
      const rejected = await invoke(badFlags, valid);
      assert.equal(rejected.code, 1);
      assert.equal(rejected.stdout, '');
    }
    assert.deepEqual((await readdir(directory)).sort(), names);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, chmod, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ledgerModule = pathToFileURL(resolve(repoRoot, 'ops/faisca/openai/durable-reservation-ledger.mjs')).href;
const workerScript = [
  'import { createFaiscaLocalReservationLedger } from ' + JSON.stringify(ledgerModule) + ';',
  'try {',
  ' const ledger = createFaiscaLocalReservationLedger({ directory: process.argv[1], maxRequests: 1, maxBudgetUsd: 1 });',
  ' await ledger.reserve(0.40);',
  ' process.stdout.write("reserved");',
  '} catch { process.stdout.write("refused"); process.exitCode = 3; }'
].join('\n');

function isolatedWorker(directory) {
  return new Promise((resolvePromise, reject) => {
    // Do not pass API keys, review tokens or other environment secrets.
    const child = spawn(process.execPath, ['--input-type=module', '-e', workerScript, directory], {
      cwd: repoRoot, env: { PATH: process.env.PATH ?? '' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolvePromise({ code, stdout, stderr }));
  });
}

test('R84 eight separate Node processes cannot reserve the final API slot twice', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r84-processes-'));
  await chmod(directory, 0o700);
  try {
    const outcomes = await Promise.all(Array.from({ length: 8 }, () => isolatedWorker(directory)));
    const accepted = outcomes.filter(item => item.code === 0 && item.stdout === 'reserved');
    const denied = outcomes.filter(item => item.code === 3 && item.stdout === 'refused');
    assert.equal(accepted.length, 1, JSON.stringify(outcomes));
    assert.equal(denied.length, 7, JSON.stringify(outcomes));
    const ledger = JSON.parse(await readFile(join(directory, 'faisca-reservations.json'), 'utf8'));
    assert.equal(ledger.requests, 1);
    assert.equal(ledger.reservedMicros, 400000);
    const restarted = await isolatedWorker(directory);
    assert.equal(restarted.code, 3);
    assert.equal(restarted.stdout, 'refused');
    assert.equal((JSON.parse(await readFile(join(directory, 'faisca-reservations.json'), 'utf8'))).requests, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('R84 crash remnant lock blocks a fresh process without creating paid quota', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r84-crashed-'));
  await chmod(directory, 0o700);
  try {
    await writeFile(join(directory, '.faisca-reservations.lock'), 'incomplete_previous_write', { mode: 0o600 });
    const denied = await isolatedWorker(directory);
    assert.equal(denied.code, 3);
    assert.equal(denied.stdout, 'refused');
    await assert.rejects(readFile(join(directory, 'faisca-reservations.json'), 'utf8'), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

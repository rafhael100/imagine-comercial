import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, lstat, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { consumeFaiscaIndependentWitnessNonce } from '../ops/faisca/openai/private-independent-review-nonce-ledger.mjs';

const nonce = 'b'.repeat(32);
async function privateDir() {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r177-'));
  await chmod(directory, 0o700);
  return directory;
}

test('R177 atomically consumes a signed witness nonce once across concurrent processes/calls and restart', async () => {
  const directory = await privateDir();
  try {
    const outcomes = await Promise.all(Array.from({ length: 12 }, () =>
      consumeFaiscaIndependentWitnessNonce({ directory, nonce })));
    assert.equal(outcomes.filter(Boolean).length, 1);
    const entries = await readdir(directory);
    assert.equal(entries.length, 1);
    assert.match(entries[0], /^[a-f0-9]{64}\.used$/u);
    assert.equal(entries[0].includes(nonce), false);
    const path = join(directory, entries[0]);
    assert.equal(await readFile(path, 'utf8'), 'consumed\n');
    assert.equal((await lstat(path)).mode & 0o777, 0o600);
    // A new invocation after the first writer has exited must fail closed.
    assert.equal(await consumeFaiscaIndependentWitnessNonce({ directory, nonce }), false);
    assert.equal(await consumeFaiscaIndependentWitnessNonce({ directory, nonce: 'c'.repeat(32) }), true);
    assert.equal((await readdir(directory)).length, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('R177 rejects missing, symlinked, non-private and unauthorized replay registries', async () => {
  const directory = await privateDir();
  const alias = directory + '-alias';
  try {
    await symlink(directory, alias);
    for (const input of [
      { directory: alias, nonce },
      { directory: 'relative/not-allowed', nonce },
      { directory, nonce: 'Z'.repeat(32) },
      { directory, nonce: 'b'.repeat(31) },
      { directory: undefined, nonce },
      { directory, nonce: undefined }
    ]) assert.equal(await consumeFaiscaIndependentWitnessNonce(input), false);

    await chmod(directory, 0o755);
    assert.equal(await consumeFaiscaIndependentWitnessNonce({ directory, nonce }), false);
    await chmod(directory, 0o700);
    assert.equal((await readdir(directory)).length, 0);
    assert.equal(await consumeFaiscaIndependentWitnessNonce({ directory, nonce }), true);
  } finally {
    await rm(alias, { force: true });
    await rm(directory, { recursive: true, force: true });
  }
});

test('R177 CLI enforces private nonce registry ONLY for signed review and consumes after postread checkout', async () => {
  const cli = await readFile(new URL('../scripts/faisca-private-provider-offline-audit.mjs', import.meta.url), 'utf8');
  assert.match(cli, /FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE_DIRECTORY/u);
  assert.match(cli, /!acknowledged \|\| !witnessGate\.allowed \|\| !nonceGate/u);
  assert.match(cli, /else if \(witnessGate\.verified && !\(await consumeFaiscaIndependentWitnessNonce/u);
  assert.ok(cli.indexOf('const afterCheckout = await inspectCheckout(git)') <
    cli.indexOf('else if (witnessGate.verified && !(await consumeFaiscaIndependentWitnessNonce'));
  assert.ok(cli.indexOf('else if (witnessGate.verified && !(await consumeFaiscaIndependentWitnessNonce') <
    cli.indexOf('console.log(JSON.stringify({'));
  assert.match(cli, /independentReviewWitnessVerified: witnessGate\.verified/u);
  assert.match(cli, /COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW' \? 2 : 1/u);
});

test('R177 disabled-CI CLI never leaks nonce/directory or writes replay records', async () => {
  const directory = await privateDir();
  const marker = 'synthetic-private-nonce-metadata';
  try {
    const result = spawnSync(process.execPath, [
      'scripts/faisca-private-provider-offline-audit.mjs', 'a'.repeat(40), 'success'
    ], {
      cwd: new URL('..', import.meta.url).pathname,
      env: {
        ...process.env, CI: 'true',
        FAISCA_PRIVATE_PROVIDER_AUDIT_ACK: 'YES_OFFLINE_NUMERIC_REVIEW_ONLY',
        FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE_DIRECTORY: directory,
        FAISCA_PRIVATE_PROVIDER_AUDIT_REVIEW_NONCE: nonce,
        FAISCA_PRIVATE_PROVIDER_AUDIT_PINS_JSON: JSON.stringify({
          before: '1'.repeat(64), after: '2'.repeat(64), aggregate: '3'.repeat(64)
        }),
        FAISCA_PRIVATE_PROVIDER_AUDIT_DIRECTORY: '/private/' + marker
      },
      encoding: 'utf8', timeout: 5000
    });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /R167 BLOCKED/u);
    assert.equal(result.stderr.includes(directory), false);
    assert.equal(result.stderr.includes(nonce), false);
    assert.equal(result.stderr.includes(marker), false);
    assert.equal((await readdir(directory)).length, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

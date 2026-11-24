import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, writeFile, appendFile, rm } from 'node:fs/promises';
import { tmpdir, devNull } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../', import.meta.url));
const cli = 'scripts/faisca-private-staging-sequence.mjs';
const helper = 'ops/faisca/openai/private-staging-git-evidence.mjs';
const sequence = 'ops/faisca/openai/private-staging-sequence.mjs';
const ledger = 'ops/faisca/openai/durable-reservation-ledger.mjs';
const baseEnv = { PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: 'C',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: devNull };
const observerEnv = { ...baseEnv,
  FAISCA_PRIVATE_SYNTHETIC_CONVERSATION: 'YES_SYNTHETIC_ONLY',
  FAISCA_PRIVATE_SEQUENCE_ACK: 'YES_NEGATIVE_THEN_POSITIVE_UP_TO_TWO_MODEL_CALLS',
  FAISCA_PRIVATE_LEDGER_AUDIT_ACK: 'YES_LOCAL_READONLY_NO_PROVIDER_PROOF',
  FAISCA_REVIEW_BEARER_TOKEN: 'R347_BEARER_FIXTURE_NOT_A_SECRET_2026' };

async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r347-'));
  try {
    const git = (...args) => execFileSync('git', args, {
      cwd: root, env: baseEnv, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
    for (const path of [cli, helper]) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await copyFile(join(source, path), join(root, path));
    }
    // Harmless sentinels: no provider, filesystem ledger or HTTP access.
    await writeFile(join(root, sequence), 'export async function inspectFaiscaPrivateConversationSequence() { return { status: "PRIVATE_SYNTHETIC_SEQUENCE_ENVELOPES_VERIFIED", localLedgerDeltasVerified: true }; }\n');
    await writeFile(join(root, ledger), 'export function createFaiscaLocalReservationLedger() { return {}; }\n');
    await writeFile(join(root, '.gitignore'), '*.ignored\n');
    git('init', '-q');
    git('add', '.');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture');
    const head = git('rev-parse', 'HEAD');
    const run = (extra = {}, pin = head) => spawnSync(process.execPath, [join(root, cli), pin], {
      cwd: root, env: { ...observerEnv, ...extra }, encoding: 'utf8', timeout: 15000
    });
    await fn({ root, run, head, git });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('R347 observer uses isolated Git even with inherited Git overrides', async () => {
  await fixture(async ({ root, run }) => {
    const result = run({ GIT_DIR: join(root, 'nonexistent'), GIT_INDEX_FILE: join(root, 'bogus'),
      GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.fsmonitor',
      GIT_CONFIG_VALUE_0: '/nonexistent' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).localLedgerDeltasVerified, true);
    assert.equal(result.stdout.includes(observerEnv.FAISCA_REVIEW_BEARER_TOKEN), false);
  });
});

test('R347 observer refuses a provider-key environment without printing its value', async () => {
  await fixture(async ({ run }) => {
    const synthetic = 'sk-r347-fixture-not-a-provider-secret';
    for (const value of [synthetic, '']) {
      const result = run({ OPENAI_API_KEY: value });
      assert.equal(result.status, 2);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /bearer-only/);
      assert.equal(result.stderr.includes(synthetic), false);
    }
  });
});

for (const [name, path] of [
  ['untracked ordinary file', 'unexpected.txt'],
  ['ignored private source', 'ops/faisca/openai/extra.ignored']
]) {
  test('R347 observer rejects ' + name, async () => {
    await fixture(async ({ root, run }) => {
      await writeFile(join(root, path), 'fixture');
      const result = run();
      assert.equal(result.status, 2, result.stderr);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /fully clean SHA/);
    });
  });
}

test('R347 observer refuses dirty tracked private source and wrong pin', async () => {
  await fixture(async ({ root, run }) => {
    assert.equal(run({}, '0'.repeat(40)).status, 2);
    await appendFile(join(root, sequence), '// changed fixture\n');
    const result = run();
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
  });
});

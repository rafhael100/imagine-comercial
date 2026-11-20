import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, chmodSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = resolve(root, 'scripts/faisca-openai-private-review-server.mjs');
const key = 'sk-R91_SYNTHETIC_NOT_REAL_SECRET_123456789';
const token = 'R91_SYNTHETIC_REVIEW_BEARER_123456789012345';

function execute(t, pin) {
  const dir = mkdtempSync(join(tmpdir(), 'faisca-r91-gate-'));
  chmodSync(dir, 0o700);
  t.after(() => rmSync(dir, { force: true, recursive: true }));
  const env = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    OPENAI_API_KEY: key,
    FAISCA_REVIEW_BEARER_TOKEN: token,
    FAISCA_PRIVATE_LEDGER_DIR: dir,
    IMAGINE_FAISCA_OPENAI_LIVE_TEST: 'YES_PAY_SYNTHETIC_ONLY'
    // Deliberately no CI/GITHUB_ACTIONS, to exercise the actual preflight.
    // No legitimate staging SHA is provisioned and no API call is possible.
  };
  if (pin !== undefined) env.FAISCA_STAGING_REVIEW_SHA = pin;
  const child = spawnSync(process.execPath, [script], {
    cwd: root, env, encoding: 'utf8', timeout: 12000
  });
  assert.equal(child.error, undefined, 'Private launcher must terminate on denied pin.');
  assert.equal(child.status, 1);
  assert.doesNotMatch(child.stdout ?? '', /started on|localhost:|Bearer /i);
  assert.match(child.stderr ?? '', /preflight CLI/);
  const diagnostic = (child.stdout ?? '') + (child.stderr ?? '');
  assert.equal(diagnostic.includes(key), false);
  assert.equal(diagnostic.includes(token), false);
  assert.equal(diagnostic.includes(dir), false);
  assert.equal(existsSync(join(dir, 'faisca-reservations.json')), false);
  return diagnostic;
}

test('R91 paid staging entrypoint rejects missing reviewed pin before server or ledger reservation', t => {
  execute(t, undefined);
});

test('R91 paid staging entrypoint rejects forged SHA instead of trusting its own checkout', t => {
  execute(t, '0'.repeat(40));
});

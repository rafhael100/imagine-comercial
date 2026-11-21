import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { hasFaiscaStableOperatorCheckout } from '../ops/faisca/openai/private-operator-checkout-recheck.mjs';

const SHA = 'a'.repeat(40);
const snapshot = Object.freeze({ head: SHA, dirty: '', trackedIndex: 'H safe.txt\0', indexSafe: true });

test('R174 rejects a changed head, status or index and never grants public GO', () => {
  assert.equal(hasFaiscaStableOperatorCheckout(snapshot, snapshot, SHA), true);
  for (const changed of [
    { ...snapshot, head: 'b'.repeat(40) },
    { ...snapshot, dirty: ' M safe.txt' },
    { ...snapshot, trackedIndex: 'H replaced.txt\0' },
    { ...snapshot, indexSafe: false },
    { ...snapshot, extra: 'untrusted' },
    null, {}, []
  ]) assert.equal(hasFaiscaStableOperatorCheckout(snapshot, changed, SHA), false);
  assert.equal(hasFaiscaStableOperatorCheckout(snapshot, snapshot, 'not-a-sha'), false);
});

test('R174 detects a real tracked change between two clean-checkout observations', async t => {
  if (process.platform !== 'linux') return t.skip('Linux Git fixture');
  const dir = await mkdtemp(join(tmpdir(), 'faisca-r174-git-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const env = {
    LANG: 'C', LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0'
  };
  const prefix = ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null',
    '-c', 'core.untrackedCache=false'];
  const run = args => spawnSync('/usr/bin/git', [...prefix, ...args], {
    cwd: dir, env, encoding: 'utf8', timeout: 3000
  });
  assert.equal(run(['init', '-q']).status, 0);
  await writeFile(join(dir, 'safe.txt'), 'safe\n');
  assert.equal(run(['add', 'safe.txt']).status, 0);
  assert.equal(run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'base']).status, 0);
  const expectedSha = run(['rev-parse', 'HEAD']).stdout.trim();
  const inspect = () => ({
    head: run(['rev-parse', 'HEAD']).stdout.trim(),
    dirty: run(['status', '--porcelain', '--untracked-files=all']).stdout.trim(),
    trackedIndex: run(['ls-files', '-v', '-z']).stdout,
    indexSafe: run(['ls-files', '-v', '-z']).stdout === 'H safe.txt\0'
  });
  const before = inspect();
  assert.equal(hasFaiscaStableOperatorCheckout(before, inspect(), expectedSha), true);
  await writeFile(join(dir, 'safe.txt'), 'changed during evidence read\n');
  assert.equal(hasFaiscaStableOperatorCheckout(before, inspect(), expectedSha), false);
});

test('R174 private CLI checks before and after the read and prints report only after postcheck', async () => {
  const cli = await readFile(new URL('../scripts/faisca-private-provider-offline-audit.mjs', import.meta.url), 'utf8');
  assert.equal((cli.match(/await inspectCheckout\(git\)/gu) ?? []).length, 2);
  assert.match(cli, /hasFaiscaStableOperatorCheckout\(beforeCheckout, afterCheckout, sha\)/u);
  const finalReportLog = cli.indexOf('console.log(JSON.stringify({');
  assert.ok(finalReportLog > -1, 'Only the postcheck may emit the final numeric report');
  assert.ok(cli.indexOf('const afterCheckout = await inspectCheckout(git)') < finalReportLog);
});

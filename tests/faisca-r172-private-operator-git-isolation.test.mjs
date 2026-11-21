import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createFaiscaIsolatedGitInvocation } from '../ops/faisca/openai/private-operator-git-isolation.mjs';

const blockedEnv = {
  OPENAI_API_KEY: 'sk-private-synthetic-should-not-inherit',
  FAISCA_REVIEW_BEARER_TOKEN: 'private-test-token',
  FAISCA_PRIVATE_PROVIDER_AUDIT_PINS_JSON: '{"secret":"synthetic"}',
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'core.fsmonitor',
  GIT_CONFIG_VALUE_0: '/tmp/should-never-run',
  GIT_TRACE: '1',
  PATH: '/tmp/untrusted-git-binary'
};

test('R172 Git invocation never inherits OpenAI credentials, pins, tokens, Git overrides or PATH', () => {
  const isolated = createFaiscaIsolatedGitInvocation(blockedEnv);
  assert.equal(isolated.executable, '/usr/bin/git');
  assert.equal(isolated.env.GIT_CONFIG_NOSYSTEM, '1');
  assert.equal(isolated.env.GIT_CONFIG_GLOBAL, '/dev/null');
  assert.equal(isolated.env.GIT_OPTIONAL_LOCKS, '0');
  assert.equal(isolated.env.GIT_TERMINAL_PROMPT, '0');
  for (const key of Object.keys(blockedEnv)) {
    assert.equal(Object.hasOwn(isolated.env, key), false, key);
  }
  assert.deepEqual(isolated.prefix.slice(0, 2), ['-c', 'core.fsmonitor=false']);
  assert.deepEqual(isolated.prefix.slice(2, 4), ['-c', 'core.hooksPath=/dev/null']);
  assert.equal(Object.isFrozen(isolated.env), true);
  assert.equal(Object.isFrozen(isolated.prefix), true);
});

test('R172 isolated Git works without ambient environment and does not echo test credentials', t => {
  if (process.platform !== 'linux') {
    t.skip('Operator audit is POSIX/Linux-only');
    return;
  }
  const isolated = createFaiscaIsolatedGitInvocation();
  const result = spawnSync(isolated.executable, [...isolated.prefix, '--version'], {
    env: isolated.env, encoding: 'utf8', timeout: 3000
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^git version /u);
  assert.equal(result.stderr.includes(blockedEnv.OPENAI_API_KEY), false);
});

test('R172 operator CLI uses isolated Git in both SHA and dirty-check, not generic inherited exec', async () => {
  const cli = await readFile(new URL('../scripts/faisca-private-provider-offline-audit.mjs', import.meta.url), 'utf8');
  assert.match(cli, /createFaiscaIsolatedGitInvocation\(\)/u);
  assert.match(cli, /exec\(git\.executable, \[\.\.\.git\.prefix, 'rev-parse', 'HEAD'\]/u);
  assert.match(cli, /'status', '--porcelain', '--untracked-files=all'/u);
  assert.equal((cli.match(/env: git\.env/gu) ?? []).length, 2);
  assert.equal(cli.includes("exec('git'"), false);
});

test('R172 ignores malicious local fsmonitor even if repository config attempts to run it', async t => {
  if (process.platform !== 'linux') {
    t.skip('POSIX local-git fixture requires Linux');
    return;
  }
  const dir = await mkdtemp(join(tmpdir(), 'faisca-r172-git-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const git = createFaiscaIsolatedGitInvocation();
  const runner = args => spawnSync(git.executable, [...git.prefix, ...args], {
    cwd: dir, env: git.env, encoding: 'utf8', timeout: 3000
  });
  assert.equal(runner(['init', '-q']).status, 0);
  const marker = join(dir, 'fsmonitor-was-executed');
  // The malicious setting remains in the fixture repo, but -c takes precedence.
  assert.equal(runner(['config', '--local', 'core.fsmonitor',
    'touch ' + marker]).status, 0);
  assert.equal(runner(['status', '--porcelain', '--untracked-files=all']).status, 0);
  await assert.rejects(access(marker));
});

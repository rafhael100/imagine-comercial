import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { hasFaiscaSafeTrackedIndex } from '../ops/faisca/openai/private-operator-git-index-proof.mjs';

const git = '/usr/bin/git';
const isolatedEnv = {
  LANG: 'C', LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0'
};
const prefix = ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null',
  '-c', 'core.untrackedCache=false'];

test('R173 accepts only bounded NUL-framed uppercase H tracked entries', () => {
  assert.equal(hasFaiscaSafeTrackedIndex('H ops/index.mjs\0H tests/fixture file.test.mjs\0'), true);
  for (const bad of [null, undefined, '', 'H ok', 'H ok\n', 'H \0',
    'h ops/index.mjs\0', 'S ops/index.mjs\0', 's ops/index.mjs\0',
    'M ops/index.mjs\0', 'H valid\0h hidden\0', 'H valid\0\0',
    'H valid\0'.repeat(300000)]) {
    assert.equal(hasFaiscaSafeTrackedIndex(bad), false);
  }
});

test('R173 detects assume-unchanged and skip-worktree flags even if status appears clean', async t => {
  if (process.platform !== 'linux') return t.skip('Linux Git fixture');
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r173-index-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const run = args => spawnSync(git, [...prefix, ...args], {
    cwd: directory, env: isolatedEnv, encoding: 'utf8', timeout: 3000
  });
  assert.equal(run(['init', '-q']).status, 0);
  await writeFile(join(directory, 'fixture.txt'), 'original\n');
  assert.equal(run(['add', 'fixture.txt']).status, 0);
  assert.equal(run([
    '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    'commit', '-qm', 'initial'
  ]).status, 0);
  let listing = run(['ls-files', '-v', '-z']);
  assert.equal(listing.status, 0);
  assert.equal(hasFaiscaSafeTrackedIndex(listing.stdout), true);
  assert.equal(run(['update-index', '--assume-unchanged', 'fixture.txt']).status, 0);
  await writeFile(join(directory, 'fixture.txt'), 'changed but hidden\n');
  assert.equal(run(['status', '--porcelain']).stdout, '');
  listing = run(['ls-files', '-v', '-z']);
  assert.equal(hasFaiscaSafeTrackedIndex(listing.stdout), false);
  assert.equal(listing.stdout[0], 'h');
  assert.equal(run(['update-index', '--no-assume-unchanged', 'fixture.txt']).status, 0);
  assert.equal(run(['update-index', '--skip-worktree', 'fixture.txt']).status, 0);
  listing = run(['ls-files', '-v', '-z']);
  assert.equal(listing.stdout[0], 'S');
  assert.equal(hasFaiscaSafeTrackedIndex(listing.stdout), false);
});

test('R173 CLI applies index flag gate after independent Git status and before offline file reads', async () => {
  const cli = await readFile(new URL('../scripts/faisca-private-provider-offline-audit.mjs', import.meta.url), 'utf8');
  assert.match(cli, /hasFaiscaSafeTrackedIndex\(trackedIndex\)/u);
  assert.match(cli, /'ls-files', '-v', '-z'/u);
  assert.match(cli, /env: git\.env/gu);
  assert.equal(cli.includes("exec('git'"), false);
});

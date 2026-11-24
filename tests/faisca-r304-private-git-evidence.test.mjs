import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { privateStagingGitRevision, privateStagingCleanWorktree }
  from '../ops/faisca/openai/private-staging-git-evidence.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'faisca-r304-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q');
  await writeFile(join(dir, 'fixture.txt'), 'reviewed synthetic fixture\n');
  git('add', 'fixture.txt');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-qm', 'synthetic');
  return { dir, git };
}

test('R304 a clean pinned checkout passes; dirty tracked files fail', async t => {
  const { dir, git } = await fixture(t);
  assert.equal(await privateStagingGitRevision(dir), git('rev-parse', 'HEAD'));
  assert.equal(await privateStagingCleanWorktree(dir), true);
  await writeFile(join(dir, 'fixture.txt'), 'changed synthetic fixture\n');
  assert.equal(await privateStagingCleanWorktree(dir), false);
});

for (const flag of ['--assume-unchanged', '--skip-worktree']) {
  test('R304 rejects hidden index flags: ' + flag, async t => {
    const { dir, git } = await fixture(t);
    git('update-index', flag, 'fixture.txt');
    await writeFile(join(dir, 'fixture.txt'), 'changed synthetic fixture\n');
    assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
    assert.equal(await privateStagingCleanWorktree(dir), false);
  });
}

test('R304 Git evidence ignores inherited alternate index and Git config overrides', async t => {
  const { dir, git } = await fixture(t);
  const sha = git('rev-parse', 'HEAD');
  const previous = process.env.GIT_INDEX_FILE;
  const previousGitDir = process.env.GIT_DIR;
  try {
    process.env.GIT_INDEX_FILE = join(dir, 'nonexistent-index');
    process.env.GIT_DIR = join(dir, 'nonexistent-git-dir');
    assert.equal(await privateStagingGitRevision(dir), sha);
    assert.equal(await privateStagingCleanWorktree(dir), true);
  } finally {
    if (previous === undefined) delete process.env.GIT_INDEX_FILE;
    else process.env.GIT_INDEX_FILE = previous;
    if (previousGitDir === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = previousGitDir;
  }
});

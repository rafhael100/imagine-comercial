import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { privateStagingCleanWorktree } from '../ops/faisca/openai/private-staging-git-evidence.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'faisca-r305-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'core.autocrlf', 'false');
  await mkdir(join(dir, 'ops/faisca'), { recursive: true });
  await mkdir(join(dir, 'scripts'));
  await writeFile(join(dir, '.gitattributes'), '*.mjs text eol=lf\n');
  await writeFile(join(dir, '.gitignore'), '*.ignored.mjs\n');
  const source = 'export const synthetic = true;\n';
  const path = join(dir, 'ops/faisca/fixture.mjs');
  await writeFile(path, source);
  await writeFile(join(dir, 'scripts/faisca-fixture.mjs'), source);
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-qm', 'synthetic');
  return { dir, git, source, path };
}

test('R305 private source is checked as raw bytes, not Git-normalized text', async t => {
  const { dir, git, source, path } = await fixture(t);
  assert.equal(await privateStagingCleanWorktree(dir), true);
  await writeFile(path, source.replaceAll('\n', '\r\n'));
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
  assert.equal(await privateStagingCleanWorktree(dir), false);
});

for (const relative of ['ops/faisca/extra.mjs', 'ops/faisca/extra.ignored.mjs', 'scripts/faisca-extra.ignored.mjs']) {
  test('R305 refuses unexpected private files: ' + relative, async t => {
    const { dir, git } = await fixture(t);
    await writeFile(join(dir, relative), '// synthetic extra\n');
    assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
    assert.equal(await privateStagingCleanWorktree(dir), false);
  });
}

test('R305 permits untracked files outside the private executable scope', async t => {
  const { dir } = await fixture(t);
  await writeFile(join(dir, 'local.ignored.mjs'), '// unrelated fixture\n');
  assert.equal(await privateStagingCleanWorktree(dir), true);
});

test('R305 refuses symlinks instead of reading the target', async t => {
  const { dir, path } = await fixture(t);
  await rm(path);
  await symlink(join(dir, 'scripts/faisca-fixture.mjs'), path);
  assert.equal(await privateStagingCleanWorktree(dir), false);
});

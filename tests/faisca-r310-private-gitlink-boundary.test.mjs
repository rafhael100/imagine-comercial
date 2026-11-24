import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { privateStagingCleanWorktree } from '../ops/faisca/openai/private-staging-git-evidence.mjs';

test('R310 rejects a clean gitlink outside private scope without inspecting its worktree', async t => {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r310-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const commit = cwd => git(cwd, '-c', 'user.name=Fixture', '-c',
    'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false',
    'commit', '-qm', 'synthetic');
  git(root, 'init', '-q');
  await mkdir(join(root, 'ops/faisca'), { recursive: true });
  await writeFile(join(root, 'ops/faisca/fixture.mjs'), 'export const synthetic = true;\n');
  git(root, 'add', '.');
  commit(root);
  assert.equal(await privateStagingCleanWorktree(root), true);
  const nested = join(root, 'nested');
  await mkdir(nested);
  git(nested, 'init', '-q');
  await writeFile(join(nested, '.gitattributes'), '*.txt filter=synthetic\n');
  await writeFile(join(nested, 'fixture.txt'), 'initial\n');
  git(nested, 'add', '.');
  commit(nested);
  const head = git(nested, 'rev-parse', 'HEAD');
  git(root, 'update-index', '--add', '--cacheinfo', '160000,' + head + ',nested');
  commit(root);
  assert.equal(git(root, 'status', '--porcelain', '--untracked-files=no'), '');
  assert.equal(await privateStagingCleanWorktree(root), false);
  const marker = join(nested, 'filter-ran');
  git(nested, 'config', 'filter.synthetic.clean', 'touch filter-ran; cat');
  await writeFile(join(nested, 'fixture.txt'), 'changed bytes\n');
  assert.equal(await privateStagingCleanWorktree(root), false);
  await assert.rejects(access(marker), { code: 'ENOENT' });
});

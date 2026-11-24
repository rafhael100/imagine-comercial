import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { privateStagingGitRevision, privateStagingCleanWorktree }
  from '../ops/faisca/openai/private-staging-git-evidence.mjs';

test('R308 exact checkout root is required for both revision and private byte evidence', async t => {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r308-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const nested = join(root, 'nested');
  git(root, 'init', '-q');
  await mkdir(nested);
  await mkdir(join(root, 'ops/faisca'), { recursive: true });
  await writeFile(join(nested, 'fixture.txt'), 'synthetic\n');
  await writeFile(join(root, 'ops/faisca/fixture.mjs'), 'export const fixture = true;\n');
  git(root, 'add', '.');
  git(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-qm', 'synthetic');
  const sha = git(root, 'rev-parse', 'HEAD');
  assert.equal(git(nested, 'rev-parse', 'HEAD'), sha);
  assert.equal(git(nested, 'status', '--porcelain'), '');
  assert.equal(await privateStagingGitRevision(root), sha);
  assert.equal(await privateStagingCleanWorktree(root), true);
  await assert.rejects(privateStagingGitRevision(nested), { message: 'PRIVATE_CHECKOUT_ROOT_REQUIRED' });
  assert.equal(await privateStagingCleanWorktree(nested), false);
});

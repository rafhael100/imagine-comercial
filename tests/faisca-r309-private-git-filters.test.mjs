import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, access, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { privateStagingCleanWorktree } from '../ops/faisca/openai/private-staging-git-evidence.mjs';

test('R309 status never executes configured clean or process filters outside the private scope', async t => {
  const root = await mkdtemp(join(tmpdir(), 'faisca-r309-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'core.autocrlf', 'false');
  await mkdir(join(root, 'ops/faisca'), { recursive: true });
  await writeFile(join(root, 'ops/faisca/fixture.mjs'), 'export const synthetic = true;\n');
  await writeFile(join(root, '.gitattributes'), '*.txt filter=synthetic\n');
  const tracked = join(root, 'fixture.txt');
  const marker = join(root, 'filter-ran');
  await writeFile(tracked, 'initial\n');
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-qm', 'synthetic');
  git('config', 'filter.synthetic.clean', 'touch filter-ran; cat');
  git('config', 'filter.synthetic.required', 'true');
  await writeFile(tracked, 'changed\n');
  await utimes(tracked, 946684800, 946684800);
  // Prove the ordinary Git command really invokes the configured driver.
  assert.match(git('status', '--porcelain', '--untracked-files=no'), /fixture\.txt/);
  await access(marker);
  await rm(marker);
  assert.equal(await privateStagingCleanWorktree(root), false);
  await assert.rejects(access(marker), { code: 'ENOENT' });
  // A process driver takes precedence over clean. It must also be disabled.
  git('config', 'filter.synthetic.process', 'touch filter-ran; exit 1');
  assert.equal(await privateStagingCleanWorktree(root), false);
  await assert.rejects(access(marker), { code: 'ENOENT' });
  await writeFile(tracked, 'initial\n');
  assert.equal(await privateStagingCleanWorktree(root), true);
  await assert.rejects(access(marker), { code: 'ENOENT' });
});

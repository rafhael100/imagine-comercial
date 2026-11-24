import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { devNull } from 'node:os';
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const exec = promisify(execFile);

// The paid-review parent may contain OpenAI and bearer credentials. Git does
// not need them, nor any inherited GIT_DIR/GIT_INDEX_FILE/config overrides.
// Avoid invoking a configured fsmonitor command and optional index writes.
async function git(cwd, args, maxBuffer = 4096) {
  const { stdout } = await exec('git', [
    '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...args
  ], {
    cwd, timeout: 3000, maxBuffer,
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      LANG: 'C',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: devNull,
      GIT_OPTIONAL_LOCKS: '0',
      GIT_NO_REPLACE_OBJECTS: '1'
    }
  });
  return stdout;
}

async function isCheckoutRoot(cwd) {
  // Git discovers a parent repository from a nested directory. The private
  // pathspecs below are relative to cwd, so that is not valid evidence.
  return (await git(cwd, ['rev-parse', '--show-prefix'], 4096)) === '\n';
}

export async function privateStagingGitRevision(cwd) {
  if (!await isCheckoutRoot(cwd)) throw new Error('PRIVATE_CHECKOUT_ROOT_REQUIRED');
  return (await git(cwd, ['rev-parse', 'HEAD'], 1024)).trim();
}


// Git status is not byte evidence: clean filters and line-ending conversion
// may report a clean checkout while Node sees different source bytes.
// Restrict the private executable tree to tracked regular files, without
// invoking Git filters to calculate their hashes. Never report file names.
async function privateSourceMatchesIndex(cwd) {
  const scope = ['--', 'ops/faisca', 'scripts/faisca-*'];
  const extras = await git(cwd, ['ls-files', '--others', '-z', ...scope], 2 * 1024 * 1024);
  if (extras !== '') return false;
  const entries = (await git(cwd, ['ls-files', '--stage', '-z', ...scope], 2 * 1024 * 1024))
    .split('\0').filter(Boolean);
  let total = 0;
  for (const entry of entries) {
    const match = /^(100644|100755) ([0-9a-f]{40}) 0\t([^\0]+)$/.exec(entry);
    if (!match) return false;
    const parts = match[3].split('/');
    if (parts.some(part => !part || part === '.' || part === '..' || part.includes('\\'))) return false;
    let file = cwd;
    for (const part of parts.slice(0, -1)) {
      file = join(file, part);
      if (!(await lstat(file)).isDirectory()) return false;
    }
    file = join(file, parts.at(-1));
    const stat = await lstat(file);
    if (!stat.isFile() || stat.size > 16 * 1024 * 1024) return false;
    total += stat.size;
    if (total > 128 * 1024 * 1024) return false;
    const bytes = await readFile(file);
    if (bytes.length !== stat.size) return false;
    const digest = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    if (digest !== match[2]) return false;
  }
  return true;
}

// Git status may run repository-configured clean/process filters when it
// refreshes a changed tracked file (even outside the private source scope).
// A review must not execute these commands. Read only config key names, then
// override each configured driver for the status subprocess. Unexpected names
// fail closed; the private source is already compared as raw bytes.
async function gitStatusWithoutFilters(cwd, rejectUntracked) {
  const keys = (await git(cwd, ['config', '--null', '--name-only', '--list'],
    2 * 1024 * 1024)).split('\0').filter(Boolean);
  const drivers = new Set();
  for (const key of keys) {
    const match = /^filter\.(.+)\.(clean|process|required)$/s.exec(key);
    if (!match) continue;
    if (!/^[A-Za-z0-9_.-]+$/.test(match[1])) throw new Error('PRIVATE_GIT_FILTER_NAME');
    drivers.add(match[1]);
  }
  const overrides = [...drivers].flatMap(name => [
    '-c', 'filter.' + name + '.clean=',
    '-c', 'filter.' + name + '.process=',
    '-c', 'filter.' + name + '.required=false'
  ]);
  return git(cwd, [...overrides, 'status', '--porcelain', rejectUntracked ? '--untracked-files=all' : '--untracked-files=no',
    '--ignore-submodules=all']);
}

export async function privateStagingCleanWorktree(cwd, { rejectUntracked = false } = {}) {
  if (!await isCheckoutRoot(cwd)) return false;
  // git status can report a clean worktree for tracked files marked
  // assume-unchanged (lowercase) or skip-worktree (S). Reject such indexes
  // instead of treating them as a reviewed checkout.
  const entries = (await git(cwd, ['ls-files', '-v', '-z'], 2 * 1024 * 1024))
    .split('\0').filter(Boolean);
  if (!entries.length || entries.some(entry => !entry.startsWith('H '))) return false;
  // A submodule can run its own Git with repository-local configuration.
  // This checkout is self-contained: fail closed on gitlinks anywhere,
  // rather than recurse into a different trust boundary during status.
  const stages = (await git(cwd, ['ls-files', '--stage', '-z'], 2 * 1024 * 1024))
    .split('\0').filter(Boolean);
  if (stages.some(entry => entry.startsWith('160000 '))) return false;
  if (!await privateSourceMatchesIndex(cwd)) return false;
  return (await gitStatusWithoutFilters(cwd, rejectUntracked)).trim() === '';
}

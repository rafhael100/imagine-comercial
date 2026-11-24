import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { devNull } from 'node:os';

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

export async function privateStagingGitRevision(cwd) {
  return (await git(cwd, ['rev-parse', 'HEAD'], 1024)).trim();
}

export async function privateStagingCleanWorktree(cwd) {
  // git status can report a clean worktree for tracked files marked
  // assume-unchanged (lowercase) or skip-worktree (S). Reject such indexes
  // instead of treating them as a reviewed checkout.
  const entries = (await git(cwd, ['ls-files', '-v', '-z'], 2 * 1024 * 1024))
    .split('\0').filter(Boolean);
  if (!entries.length || entries.some(entry => !entry.startsWith('H '))) return false;
  return (await git(cwd, ['status', '--porcelain', '--untracked-files=no',
    '--ignore-submodules=none'])).trim() === '';
}

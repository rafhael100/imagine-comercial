/**
 * R173: Git's porcelain status can report a checkout as clean even when the
 * index carries assume-unchanged or skip-worktree flags. Fail closed unless
 * every tracked path carries Git's ordinary uppercase H (cached) tag.
 *
 * The caller must obtain this from `git ls-files -v -z`, using R172's
 * isolated /usr/bin/git invocation, no shell, and a bounded maxBuffer.
 * Never echo filenames, index records or errors to operator-facing output.
 */
export function hasFaiscaSafeTrackedIndex(output) {
  if (typeof output !== 'string' || output.length < 4 ||
      output.length > 2 * 1024 * 1024 || !output.endsWith('\0')) {
    return false;
  }
  const entries = output.slice(0, -1).split('\0');
  return entries.length > 0 && entries.every(entry =>
    entry.length > 2 && entry.startsWith('H ') &&
    !entry.slice(2).includes('\0'));
}

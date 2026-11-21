import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

/**
 * R177: ONE-HOST, operator-controlled, durable single-use replay guard for
 * independently signed HUMAN review. Never accepts a nonce from the witness
 * as the only trust source. Never stores the raw nonce or any prompt/PII/API key.
 *
 * This is deliberately separate from the application's reservation ledger and
 * cannot authorize public activation. Cross-host coordination and independent
 * provider billing reconciliation remain operational gates.
 */
export async function consumeFaiscaIndependentWitnessNonce({ directory, nonce } = {}) {
  if (process.platform === 'win32' || typeof process.getuid !== 'function' ||
      typeof directory !== 'string' || directory.length < 2 ||
      directory.length > 4096 || !isAbsolute(directory) ||
      resolve(directory) !== directory ||
      typeof nonce !== 'string' || !/^[0-9a-f]{32}$/u.test(nonce)) return false;

  let dir;
  let marker;
  try {
    // The directory MUST pre-exist, be owned by this dedicated POSIX operator,
    // and be private. Never create it, chmod it, or follow its final symlink.
    const pathStat = await lstat(directory);
    if (!pathStat.isDirectory() || pathStat.isSymbolicLink() ||
        pathStat.uid !== process.getuid() ||
        (pathStat.mode & 0o777) !== 0o700 ||
        await realpath(directory) !== directory) return false;

    dir = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY |
      constants.O_NOFOLLOW);
    const first = await dir.stat();
    if (!first.isDirectory() || first.ino !== pathStat.ino ||
        first.dev !== pathStat.dev || first.uid !== process.getuid() ||
        (first.mode & 0o777) !== 0o700) return false;

    // Domain-separated digest is the filename, not the raw nonce. O_EXCL
    // serializes simultaneous audits on this filesystem and rejects replay
    // after process restart. Fail closed if a file already exists.
    const id = createHash('sha256').update('faisca.review.nonce.v1\0', 'utf8')
      .update(nonce, 'ascii').digest('hex');
    marker = await open(join(directory, id + '.used'),
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL |
      constants.O_NOFOLLOW, 0o600);
    const file = await marker.stat();
    if (!file.isFile() || file.nlink !== 1 || file.uid !== process.getuid() ||
        (file.mode & 0o777) !== 0o600) return false;

    await marker.writeFile('consumed\n', 'utf8');
    await marker.sync();
    await marker.close();
    marker = null;
    // Sync the directory entry, too; after a power loss, a missing marker
    // must not permit a second accepted signed report.
    await dir.sync();
    const second = await lstat(directory);
    return second.isDirectory() && !second.isSymbolicLink() &&
      second.dev === first.dev && second.ino === first.ino &&
      second.uid === process.getuid() && (second.mode & 0o777) === 0o700;
  } catch {
    // Fail closed without logging paths, witness data, nonce or exceptions.
    // Any marker left by a failed sync conservatively blocks further use.
    return false;
  } finally {
    await marker?.close().catch(() => {});
    await dir?.close().catch(() => {});
  }
}

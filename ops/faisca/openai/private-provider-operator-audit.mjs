import { open, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { auditFaiscaPrivateProviderAggregate } from './private-provider-aggregate-audit.mjs';

const READ_ONLY_NO_FOLLOW = constants.O_RDONLY | constants.O_NOFOLLOW;
const MAX_FILE_BYTES = 1024;
const OUTCOMES = new Set(['success', 'rejected', 'failed_luna', 'failed_terra']);

/**
 * R167: read only THREE strictly numeric, canonical JSON artifacts supplied
 * independently by an authorized private operator. No network, secrets,
 * provider API calls, logs, writes, billing claims or public readiness.
 *
 * This is NOT a proof that the aggregate came from OpenAI. The three files
 * are not an atomic snapshot, and a compromised host can forge all of them.
 */
export async function inspectFaiscaOfflineOperatorAggregate({ directory, outcome } = {}) {
  if (typeof directory !== 'string' || !isAbsolute(directory) ||
      normalize(directory) !== directory || directory.includes('\0') ||
      !OUTCOMES.has(outcome)) {
    throw new Error('R167 BLOCKED: invalid private audit configuration.');
  }
  const dir = await lstat(directory);
  if (!dir.isDirectory() || dir.isSymbolicLink() || (dir.mode & 0o077) !== 0 ||
      (typeof process.getuid === 'function' && dir.uid !== process.getuid()) ||
      await realpath(directory) !== directory) {
    throw new Error('R167 BLOCKED: private audit directory unavailable.');
  }

  async function readCanonical(name) {
    const path = join(directory, name);
    let file;
    try {
      file = await open(path, READ_ONLY_NO_FOLLOW);
      const info = await file.stat();
      if (!info.isFile() || info.size < 3 || info.size > MAX_FILE_BYTES ||
          (info.mode & 0o077) !== 0 ||
          (typeof process.getuid === 'function' && info.uid !== process.getuid())) {
        throw new Error('R167 BLOCKED: non-private or oversized evidence.');
      }
      const raw = await file.readFile('utf8');
      const value = JSON.parse(raw);
      if (raw !== JSON.stringify(value) + '\n' ||
          value === null || typeof value !== 'object' ||
          Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
        throw new Error('R167 BLOCKED: noncanonical evidence.');
      }
      return value;
    } finally {
      await file?.close();
    }
  }

  // Fixed file names: cannot be redirected to prompts, account exports,
  // credentials, arbitrary absolute paths, URLs or logs through arguments.
  const before = await readCanonical('before.json');
  const after = await readCanonical('after.json');
  const evidence = await readCanonical('aggregate.json');
  if (await realpath(directory) !== directory) {
    throw new Error('R167 BLOCKED: private audit directory changed.');
  }
  return auditFaiscaPrivateProviderAggregate({ before, after, evidence, outcome });
}

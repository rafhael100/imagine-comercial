import { open, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { auditFaiscaPrivateProviderAggregate } from './private-provider-aggregate-audit.mjs';

const MAX_FILE_BYTES = 1024;
const OUTCOMES = new Set(['success', 'rejected', 'failed_luna', 'failed_terra']);

// Never fall back to following symlinks or opening a FIFO in blocking mode.
const READ_ONLY_NO_FOLLOW = Number.isInteger(constants.O_NOFOLLOW) &&
  Number.isInteger(constants.O_NONBLOCK)
  ? constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
  : null;

const SAME_METADATA = [
  'dev', 'ino', 'mode', 'uid', 'gid', 'nlink', 'size', 'mtimeNs', 'ctimeNs'
];
const sameMetadata = (left, right) =>
  SAME_METADATA.every(field => left[field] === right[field]);

/**
 * R167-R169: read-only numeric evidence inspected on a private, canonical
 * filesystem path. R169 additionally fences hardlinks, inode replacement,
 * in-place modifications and growth beyond the declared file size.
 *
 * This is a best-effort consistency check, NOT an atomic three-file snapshot,
 * a trusted OpenAI attestation, an audit of invoices or public release GO.
 */
export async function inspectFaiscaOfflineOperatorAggregate(options = {}) {
  try {
    return await inspectUntrustedOfflineEvidence(options);
  } catch {
    // Error text, cause and stack from untrusted local files must not escape.
    throw new Error('R168 BLOCKED: private offline evidence rejected.');
  }
}

async function inspectUntrustedOfflineEvidence({ directory, outcome } = {}) {
  if (typeof directory !== 'string' || !isAbsolute(directory) ||
      normalize(directory) !== directory || directory.includes('\0') ||
      !OUTCOMES.has(outcome) || READ_ONLY_NO_FOLLOW === null) {
    throw new Error('R169 BLOCKED: invalid private audit configuration.');
  }

  async function privateDirectoryMetadata() {
    const info = await lstat(directory, { bigint: true });
    if (!info.isDirectory() || info.isSymbolicLink() ||
        (info.mode & 0o077n) !== 0n ||
        (typeof process.getuid === 'function' && info.uid !== BigInt(process.getuid())) ||
        await realpath(directory) !== directory) {
      throw new Error('R169 BLOCKED: private audit directory unavailable.');
    }
    return info;
  }

  const initialDirectory = await privateDirectoryMetadata();

  async function readCanonical(name) {
    let file;
    try {
      file = await open(join(directory, name), READ_ONLY_NO_FOLLOW);
      const initial = await file.stat({ bigint: true });
      if (!initial.isFile() || initial.nlink !== 1n ||
          initial.size < 3n || initial.size > BigInt(MAX_FILE_BYTES) ||
          (initial.mode & 0o077n) !== 0n ||
          (typeof process.getuid === 'function' &&
            initial.uid !== BigInt(process.getuid()))) {
        throw new Error('R169 BLOCKED: private evidence file type, link or size.');
      }

      // A bounded positional read avoids file.readFile() growing unbounded if
      // an external writer expands the file after the initial fstat.
      const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
      let bytes = 0;
      while (bytes < buffer.length) {
        const { bytesRead } = await file.read(buffer, bytes, buffer.length - bytes, bytes);
        if (bytesRead === 0) break;
        bytes += bytesRead;
      }
      const final = await file.stat({ bigint: true });
      if (!sameMetadata(initial, final) || bytes !== Number(initial.size)) {
        throw new Error('R169 BLOCKED: evidence changed or grew while reading.');
      }

      const raw = buffer.subarray(0, bytes).toString('utf8');
      const value = JSON.parse(raw);
      if (raw !== JSON.stringify(value) + '\n' ||
          value === null || typeof value !== 'object' ||
          Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
        throw new Error('R169 BLOCKED: noncanonical evidence.');
      }
      return { value, metadata: initial };
    } finally {
      await file?.close();
    }
  }

  // Only fixed names and no external URLs, account exports or arbitrary paths.
  const before = await readCanonical('before.json');
  const after = await readCanonical('after.json');
  const evidence = await readCanonical('aggregate.json');

  for (const [name, expected] of [
    ['before.json', before], ['after.json', after], ['aggregate.json', evidence]
  ]) {
    const fresh = await readCanonical(name);
    if (!sameMetadata(expected.metadata, fresh.metadata) ||
        JSON.stringify(fresh.value) !== JSON.stringify(expected.value)) {
      throw new Error('R169 BLOCKED: evidence replaced between passes.');
    }
  }
  if (!sameMetadata(initialDirectory, await privateDirectoryMetadata())) {
    throw new Error('R169 BLOCKED: private audit directory replaced.');
  }
  return auditFaiscaPrivateProviderAggregate({
    before: before.value, after: after.value,
    evidence: evidence.value, outcome
  });
}

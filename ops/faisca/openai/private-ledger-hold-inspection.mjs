// R290 — offline metadata-only inspection of three durable local NO-START
// conditions. This is NOT a readiness check: absence of markers does not
// authorize provider calls, staging installation, financial reconciliation,
// quota reset or public access. Never read marker bodies or remove entries.
import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join, normalize } from 'node:path';

const ENTRIES = Object.freeze({
  reservationLockPresent: '.faisca-reservations.lock',
  providerDispatchPresent: '.faisca-provider-dispatch-inflight',
  providerOutcomeUncertainPresent: '.faisca-provider-outcome-uncertain'
});
export const FAISCA_HOLD_INSPECTION_SCHEMA = 'faisca.private-local-holds-metadata-review.v1';

async function directoryIdentity(directory) {
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink() ||
      (info.mode & 0o077) !== 0 ||
      (typeof process.getuid === 'function' && info.uid !== process.getuid()) ||
      (await realpath(directory)) !== directory) {
    throw new Error('Unsafe private hold review directory.');
  }
  return { device: info.dev, inode: info.ino };
}

async function markerPresent(path) {
  try {
    // Any path entry means HOLD, even a symlink, directory, hardlink or
    // interrupted write. Never open or follow marker contents.
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw new Error('Private hold marker unavailable.');
  }
}

/**
 * A best-effort, read-only, single-host, non-atomic diagnostic. Re-observe the
 * directory identity and marker presence to reject simple concurrent flips;
 * a racing writer can still change state immediately afterward. The return
 * value NEVER says READY and must not be used to gate provider calls.
 */
export async function inspectFaiscaLocalPrivateHoldsReadOnly({ directory } = {}) {
  if (typeof directory !== 'string' || !isAbsolute(directory) ||
      normalize(directory) !== directory || directory.includes('\0')) {
    throw new TypeError('An absolute, normalized private directory is required.');
  }
  const before = await directoryIdentity(directory);
  const names = Object.keys(ENTRIES);
  async function observe() {
    return Promise.all(names.map(name => markerPresent(join(directory, ENTRIES[name]))));
  }
  const first = await observe();
  const after = await directoryIdentity(directory);
  const second = await observe();
  const final = await directoryIdentity(directory);
  if (before.device !== after.device || before.inode !== after.inode ||
      before.device !== final.device || before.inode !== final.inode ||
      first.some((value, index) => value !== second[index])) {
    throw new Error('Private hold markers changed during observation.');
  }
  const report = Object.fromEntries(names.map((name, index) => [name, second[index]]));
  return Object.freeze({
    schema: FAISCA_HOLD_INSPECTION_SCHEMA,
    ...report,
    holdObserved: second.some(Boolean),
    observationAtomicAcrossProcesses: false,
    providerUsageReconciled: false,
    canStartPaidCalls: false,
    canReleaseDurableFence: false,
    canResetQuota: false,
    publicReady: false,
    operationalEffects: false
  });
}

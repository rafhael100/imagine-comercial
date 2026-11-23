import {
  open, lstat, realpath, rename, unlink
} from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';

const SCHEMA = 'faisca.private-local-reservations.v1';
const STATE_NAME = 'faisca-reservations.json';
const LOCK_NAME = '.faisca-reservations.lock';
const MARKER_NAME = '.faisca-reservations-initialized';
const MARKER_DATA = 'faisca.private-local-reservations.initialized.v1\n';
// An independently fsynced, monotonically increasing high-water witness.
// It detects accidental or single-file rollback of the mutable quota state.
// It is not an external trusted log or a defense against full host compromise.
const HIGHWATER_NAME = '.faisca-reservations-highwater.json';
const HIGHWATER_MARKER_NAME = '.faisca-reservations-highwater-initialized';
const HIGHWATER_SCHEMA = 'faisca.private-local-reservations.highwater.v1';
const HIGHWATER_MARKER_DATA = HIGHWATER_SCHEMA + '\n';
// R191: a provider error after a paid dispatch is not reconciled by an
// estimated-cost reservation. Persist an operator-only NO-START marker
// across process restarts; never automatically clear it.
const PROVIDER_UNCERTAIN_NAME = '.faisca-provider-outcome-uncertain';
const PROVIDER_UNCERTAIN_DATA = 'faisca.private-provider-outcome-uncertain.v1\n';
// R196: O_EXCL + fsync dispatch marker is created before a paid network
// request. Another worker on the same host may not dispatch concurrently.
// A crash leaves this marker as an intentional permanent NO-START for review.
const PROVIDER_DISPATCH_NAME = '.faisca-provider-dispatch-inflight';
const PROVIDER_DISPATCH_DATA = 'faisca.private-provider-dispatch-inflight.v1\n';
const MAX_REQUESTS = 100;
const MAX_MICROS = 10_000_000;
const OPEN_LOCK = constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW;
const READ_ONLY = constants.O_RDONLY | constants.O_NOFOLLOW;

/**
 * Private, single-host, fail-closed reservation ledger for estimated API costs.
 * The operator provisions a dedicated mode-0700 local directory. No secrets,
 * prompts, responses, model text, identities or visitor data are persisted.
 * File-system 'wx' lock is NEVER automatically broken after a crash.
 * This is not an OpenAI billing hard stop or a multi-host quota service.
 */
export function createFaiscaLocalReservationLedger({
  directory, maxRequests = MAX_REQUESTS, maxBudgetUsd = 10
} = {}) {
  if (typeof directory !== 'string' || !isAbsolute(directory) ||
      normalize(directory) !== directory || directory.includes('\0') ||
      !Number.isSafeInteger(maxRequests) || maxRequests < 1 || maxRequests > MAX_REQUESTS ||
      typeof maxBudgetUsd !== 'number' || !Number.isFinite(maxBudgetUsd) ||
      maxBudgetUsd <= 0 || maxBudgetUsd > 10) {
    throw new TypeError('Private reservation directory and finite limits are required.');
  }
  const limitMicros = Math.floor(maxBudgetUsd * 1_000_000);
  if (limitMicros < 1) throw new TypeError('Private reservation budget too small.');
  const statePath = join(directory, STATE_NAME);
  const lockPath = join(directory, LOCK_NAME);
  const markerPath = join(directory, MARKER_NAME);
  const highwaterPath = join(directory, HIGHWATER_NAME);
  const highwaterMarkerPath = join(directory, HIGHWATER_MARKER_NAME);
  const providerUncertainPath = join(directory, PROVIDER_UNCERTAIN_NAME);
  const providerDispatchPath = join(directory, PROVIDER_DISPATCH_NAME);
  let ownedDispatch = false;
  let ownedDispatchIdentity = null;

  async function checkDirectory() {
    const dir = await lstat(directory);
    if (!dir.isDirectory() || dir.isSymbolicLink() || (dir.mode & 0o077) ||
        (typeof process.getuid === 'function' && dir.uid !== process.getuid()) ||
        await realpath(directory) !== directory) {
      throw new Error('Private ledger directory must be owned, real and mode 0700.');
    }
  }

  // A separate, fsynced marker is written BEFORE the first state update.
  // If the state later disappears, fail closed instead of silently resetting
  // credits to zero. Existing R82 state files without a marker are still read
  // and will acquire a marker on their next reservation (no quota reset).
  async function hasInitializationMarker() {
    let file;
    try {
      file = await open(markerPath, READ_ONLY);
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size !== Buffer.byteLength(MARKER_DATA) ||
          (info.mode & 0o077) || info.nlink !== 1 ||
          (typeof process.getuid === 'function' && info.uid !== process.getuid()) ||
          await file.readFile('utf8') !== MARKER_DATA) {
        throw new Error('Private ledger initialization marker requires operator review.');
      }
      return true;
    } finally {
      await file.close();
    }
  }

  async function initializeMarker() {
    if (await hasInitializationMarker()) return;
    // Called only while holding the process-shared O_EXCL ledger lock.
    // A crash before writing valid marker bytes is a hard stop, not a reset.
    const file = await open(markerPath, OPEN_LOCK, 0o600);
    try {
      await file.writeFile(MARKER_DATA);
      await file.sync();
    } finally { await file.close(); }
    const dir = await open(directory, READ_ONLY);
    try { await dir.sync(); } finally { await dir.close(); }
  }


  async function hasHighwaterMarker() {
    let file;
    try {
      file = await open(highwaterMarkerPath, READ_ONLY);
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size !== Buffer.byteLength(HIGHWATER_MARKER_DATA) ||
          (info.mode & 0o077) || info.nlink !== 1 ||
          (typeof process.getuid === 'function' && info.uid !== process.getuid()) ||
          await file.readFile('utf8') !== HIGHWATER_MARKER_DATA) {
        throw new Error('Private high-water marker requires operator review.');
      }
      return true;
    } finally { await file.close(); }
  }

  async function initializeHighwaterMarker() {
    if (await hasHighwaterMarker()) return;
    // Under the durable O_EXCL lock: marker first, then witness, then state.
    // An incomplete sequence always leaves the lock in place for the operator.
    const file = await open(highwaterMarkerPath, OPEN_LOCK, 0o600);
    try { await file.writeFile(HIGHWATER_MARKER_DATA); await file.sync(); }
    finally { await file.close(); }
    const dir = await open(directory, READ_ONLY);
    try { await dir.sync(); } finally { await dir.close(); }
  }

  async function verifyHighwater(state) {
    const initialized = await hasHighwaterMarker();
    let file;
    try {
      file = await open(highwaterPath, READ_ONLY);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (initialized) throw new Error('Private high-water witness missing; operator review required.');
      // Legacy R82/R143 state, prior to R145, may have no witness at all.
      // A successful next reservation installs it without resetting balance.
      return;
    }
    try {
      const info = await file.stat();
      if (!initialized || !info.isFile() || info.size > 512 || (info.mode & 0o077) || info.nlink !== 1 ||
          (typeof process.getuid === 'function' && info.uid !== process.getuid())) {
        throw new Error('Private high-water witness requires operator review.');
      }
      const raw = await file.readFile('utf8');
      const witness = JSON.parse(raw);
      if (!witness || Object.getPrototypeOf(witness) !== Object.prototype ||
          raw !== JSON.stringify(witness) + '\n' ||
          Object.keys(witness).sort().join(',') !==
            'limitMicros,limitRequests,requests,reservedMicros,schema' ||
          witness.schema !== HIGHWATER_SCHEMA ||
          witness.limitRequests !== state.limitRequests ||
          witness.limitMicros !== state.limitMicros ||
          witness.requests !== state.requests ||
          witness.reservedMicros !== state.reservedMicros) {
        throw new Error('Private high-water mismatch; operator review required.');
      }
    } finally { await file.close(); }
  }

  async function readState() {
    const initialized = await hasInitializationMarker();
    let file;
    try {
      file = await open(statePath, READ_ONLY);
    } catch (error) {
      if (error.code === 'ENOENT') {
        if (initialized) throw new Error('Private ledger state missing; operator review required.');
        const empty = {
          schema: SCHEMA, requests: 0, reservedMicros: 0,
          limitRequests: maxRequests, limitMicros
        };
        await verifyHighwater(empty);
        return empty;
      }
      throw error;
    }
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size > 512 || (info.mode & 0o077) || info.nlink !== 1 ||
          (typeof process.getuid === 'function' && info.uid !== process.getuid())) {
        throw new Error('Private ledger file has unsafe permissions or shape.');
      }
      // JSON.parse silently keeps the LAST occurrence of a duplicate key.
      // A mutated state such as {"requests":100,"requests":0} could otherwise
      // pass the numeric checks and reset local spend accounting. R82 writes
      // canonical JSON.stringify(value) + LF; require that exact encoding.
      // Any noncanonical/legacy external write fails closed for operator review.
      const raw = await file.readFile('utf8');
      const value = JSON.parse(raw);
      if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
          raw !== JSON.stringify(value) + '\n' ||
          Object.keys(value).sort().join(',') !==
            'limitMicros,limitRequests,requests,reservedMicros,schema' ||
          value.schema !== SCHEMA || value.limitRequests !== maxRequests ||
          value.limitMicros !== limitMicros ||
          !Number.isSafeInteger(value.requests) || value.requests < 0 || value.requests > maxRequests ||
          !Number.isSafeInteger(value.reservedMicros) ||
          value.reservedMicros < 0 || value.reservedMicros > limitMicros) {
        throw new Error('Private ledger requires operator review.');
      }
      await verifyHighwater(value);
      return value;
    } finally {
      await file.close();
    }
  }

  async function durableWrite(next, target = statePath) {
    const temp = join(directory, '.faisca-reservation-' + randomUUID() + '.tmp');
    let file;
    try {
      file = await open(temp, OPEN_LOCK, 0o600);
      await file.writeFile(JSON.stringify(next) + '\n');
      await file.sync();
      await file.close();
      file = null;
      await rename(temp, target);
      const dir = await open(directory, READ_ONLY);
      try { await dir.sync(); } finally { await dir.close(); }
    } finally {
      await file?.close().catch(() => {});
      await unlink(temp).catch(error => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }

  async function assertNoProviderUncertainty() {
    // Presence alone is a hard NO-START, even for a malformed file, symlink,
    // or interrupted marker write. Never follow or auto-delete this path.
    try {
      await lstat(providerUncertainPath);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
    }
    throw new Error('Private provider outcome uncertain; operator reconciliation required.');
  }

  async function assertNoProviderDispatch() {
    // Any entry, including an interrupted write, symlink or hardlink, is
    // treated as an active/ambiguous dispatch. No stale-lock TTL or unlink.
    try { await lstat(providerDispatchPath); }
    catch (error) { if (error?.code === 'ENOENT') return; }
    throw new Error('Private provider dispatch in flight; operator review required.');
  }

  // R199: a process must never reuse or unlock a dispatch marker that was
  // replaced after it obtained ownership (same bytes are not enough).
  // O_NOFOLLOW, inode + device and link-count checks provide a conservative
  // single-host guard. A hostile writer with the same UID still needs an
  // independent operating-system trust boundary; this is not a proof of it.
  async function assertOwnedDispatchMarker() {
    if (!ownedDispatch || !ownedDispatchIdentity) {
      throw new Error('Private provider dispatch marker requires operator review.');
    }
    let file;
    try {
      file = await open(providerDispatchPath, READ_ONLY);
      const opened = await file.stat();
      const entry = await lstat(providerDispatchPath);
      if (!opened.isFile() || !entry.isFile() || entry.isSymbolicLink() ||
          opened.dev !== ownedDispatchIdentity.dev ||
          opened.ino !== ownedDispatchIdentity.ino ||
          opened.dev !== entry.dev || opened.ino !== entry.ino ||
          opened.nlink !== 1 || (opened.mode & 0o077) ||
          (typeof process.getuid === 'function' && opened.uid !== process.getuid()) ||
          opened.size !== Buffer.byteLength(PROVIDER_DISPATCH_DATA) ||
          await file.readFile('utf8') !== PROVIDER_DISPATCH_DATA) {
        throw new Error('Private provider dispatch marker requires operator review.');
      }
    } catch {
      throw new Error('Private provider dispatch marker requires operator review.');
    } finally { await file?.close().catch(() => {}); }
    return true;
  }

  async function beginPaidDispatch() {
    // Luna and Terra may share the gate only if its original inode remains.
    if (ownedDispatch) {
      await checkDirectory();
      await assertNoProviderUncertainty();
      return assertOwnedDispatchMarker();
    }
    await checkDirectory();
    await assertNoProviderUncertainty();
    let file, dispatchIdentity;
    try {
      // The underlying O_EXCL reservation is shared by ALL local processes.
      // Never recover or delete another process's marker automatically.
      file = await open(providerDispatchPath, OPEN_LOCK, 0o600);
      // Do not claim ownership until BOTH file and directory are fsynced.
      // An I/O failure must leave the marker present but never permit reuse.
      await file.writeFile(PROVIDER_DISPATCH_DATA);
      await file.sync();
      const info = await file.stat();
      dispatchIdentity = Object.freeze({ dev: info.dev, ino: info.ino });
    } catch {
      // A partial file also stays present for crash-safe operator review.
      throw new Error('Private provider dispatch unavailable.');
    } finally { await file?.close().catch(() => {}); }
    try {
      const dir = await open(directory, READ_ONLY);
      try { await dir.sync(); } finally { await dir.close(); }
      await assertNoProviderUncertainty();
    } catch {
      // Never unlink on uncertainty or failed fsync; fail closed.
      throw new Error('Private provider dispatch unavailable.');
    }
    ownedDispatchIdentity = dispatchIdentity;
    ownedDispatch = true;
    return true;
  }

  // R269: provider completion is not enough to authorize HTTP egress.
  // An independent worker can fence the shared ledger while Terra is in flight.
  // Read-only revalidation catches that fence before publishing a response.
  // This remains a single-host, non-atomic pre-send check, not a distributed lease.
  async function assertPaidDispatchStillValid() {
    await checkDirectory();
    await assertNoProviderUncertainty();
    await assertOwnedDispatchMarker();
    return true;
  }

  async function completePaidDispatch() {
    if (!ownedDispatch) throw new Error('Private provider dispatch not owned.');
    await checkDirectory();
    await assertNoProviderUncertainty();
    // Refuse to remove a different inode even when its contents are identical.
    await assertOwnedDispatchMarker();
    // Only THIS ledger instance, after a fully validated provider reply,
    // can release its own marker; failure leaves a conservative NO-START.
    await unlink(providerDispatchPath);
    const dir = await open(directory, READ_ONLY);
    try { await dir.sync(); } finally { await dir.close(); }
    ownedDispatch = false;
    ownedDispatchIdentity = null;
    return true;
  }

  async function markOutcomeUncertain() {
    await checkDirectory();
    let file;
    try {
      file = await open(providerUncertainPath, OPEN_LOCK, 0o600);
      await file.writeFile(PROVIDER_UNCERTAIN_DATA);
      await file.sync();
    } catch (error) {
      // An existing marker is already a permanent local NO-START; do not
      // overwrite another process's marker or reveal the provider outcome.
      if (error?.code !== 'EEXIST') {
        throw new Error('Private provider uncertainty could not be durably recorded.');
      }
    } finally {
      await file?.close().catch(() => {});
    }
    const dir = await open(directory, READ_ONLY);
    try { await dir.sync(); } finally { await dir.close(); }
    return true;
  }

  async function ready({
    requireCapacity = false, minimumRequests = 1, minimumBudgetUsd = 0
  } = {}) {
    // A single private answer needs classification (Luna) AND composition
    // (Terra). Refuse a misleading READY result when only one paid call or an
    // unusably small budget remains. This is a read-only gate: other workers
    // can still reserve later, so every actual dispatch rechecks atomically.
    if (!Number.isSafeInteger(minimumRequests) || minimumRequests < 1 ||
        minimumRequests > maxRequests ||
        typeof minimumBudgetUsd !== 'number' ||
        !Number.isFinite(minimumBudgetUsd) || minimumBudgetUsd < 0 ||
        minimumBudgetUsd > maxBudgetUsd) {
      throw new TypeError('Invalid private reservation readiness floor.');
    }
    const minimumMicros = Math.ceil(minimumBudgetUsd * 1_000_000);
    await checkDirectory();
    await assertNoProviderUncertainty();
    await assertNoProviderDispatch();
    // An absent state stays absent: preflight must not create or reset quota.
    const state = await readState();
    // A stale crash lock is a hard NO-START for all callers of ready(),
    // including future callers that do not run the separate VPS preflight.
    // Never remove, follow or "recover" the lock automatically.
    let locked = false;
    try {
      await lstat(lockPath);
      locked = true;
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw new Error('Private reservation lock inspection unavailable.');
      }
    }
    if (locked) throw new Error('Private reservation locked; operator review required.');
    // A concurrent reservation can acquire the lock immediately afterwards:
    // every paid dispatch must still use reserve()'s atomic O_EXCL guard.
    if (requireCapacity &&
        (state.requests + minimumRequests > maxRequests ||
         state.reservedMicros >= limitMicros ||
         state.reservedMicros + minimumMicros > limitMicros)) {
      throw new Error('Private durable reservation limit reached.');
    }
    return true;
  }

  // R160: operator-only read-only inspection for staging reconciliation.
  // No lock creation, quota reset, provider call, key, prompt or response.
  // A competing process may complete a reservation immediately after the
  // second lock check. This is NOT an atomic multi-process snapshot, cannot
  // prove provider consumption and must never authorize a public launch.
  async function inspectReadOnly() {
    await checkDirectory();
    // Keep numeric inspection available for conservative reconciliation even
    // when a provider outcome is uncertain. This is strictly read-only and
    // never authorizes a new request; ready()/reserve() still fail closed.
    async function assertNoLock() {
      try {
        await lstat(lockPath);
        throw new Error('Private ledger reservation lock present; operator review required.');
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          throw new Error('Private ledger reservation lock present or uninspectable.');
        }
      }
    }
    await assertNoLock();
    const state = await readState();
    await assertNoLock();
    return Object.freeze({
      schema: 'faisca.private-ledger-readonly-snapshot.v1',
      requests: state.requests,
      reservedMicros: state.reservedMicros,
      limitRequests: state.limitRequests,
      limitMicros: state.limitMicros,
      atomicAcrossProcesses: false,
      providerUsageReconciled: false,
      publicReady: false,
      operationalEffects: false
    });
  }

  async function reserve(estimatedUsd) {
    if (typeof estimatedUsd !== 'number' || !Number.isFinite(estimatedUsd) ||
        estimatedUsd <= 0 || estimatedUsd > 10) {
      throw new TypeError('Finite positive reservation required.');
    }
    const micros = Math.ceil(estimatedUsd * 1_000_000);
    if (!Number.isSafeInteger(micros) || micros < 1) {
      throw new TypeError('Invalid reservation precision.');
    }
    await checkDirectory();
    await assertNoProviderUncertainty();
    if (!ownedDispatch) await assertNoProviderDispatch();
    // O_EXCL provides atomic mutual exclusion across processes on ONE host.
    // An existing lock (including a crash remnant) is a hard stop, not a retry.
    let lock;
    try {
      lock = await open(lockPath, OPEN_LOCK, 0o600);
      // Persist the exclusive lock before mutating state. If power fails
      // between a state rename and its directory fsync, a durable lock keeps
      // the next process in NO-START instead of reusing a stale allowance.
      await lock.sync();
      const lockDirectory = await open(directory, READ_ONLY);
      try { await lockDirectory.sync(); } finally { await lockDirectory.close(); }
      await lock.close();
      lock = null;
    } catch {
      await lock?.close().catch(() => {});
      throw new Error('Private durable reservation busy or unavailable.');
    }
    let safeToUnlock = false;
    try {
      // Recheck after taking the reservation lock; a separate process may
      // have marked an uncertain completion while we were acquiring it.
      await assertNoProviderUncertainty();
      if (!ownedDispatch) await assertNoProviderDispatch();
      const current = await readState();
      if (current.requests >= maxRequests ||
          current.reservedMicros + micros > limitMicros) {
        // No write attempted: an ordinary quota denial may release the lock.
        safeToUnlock = true;
        throw new Error('Private durable reservation limit reached.');
      }
      const next = {
        ...current, requests: current.requests + 1,
        reservedMicros: current.reservedMicros + micros
      };
      await initializeMarker();
      await initializeHighwaterMarker();
      // Write the independent high-water mark *before* making new state
      // visible. A crash, rollback or partial disk copy cannot present a
      // lower spent state with a matching valid witness. Ambiguity stays NO-GO.
      await durableWrite({
        schema: HIGHWATER_SCHEMA, requests: next.requests,
        reservedMicros: next.reservedMicros,
        limitRequests: next.limitRequests, limitMicros: next.limitMicros
      }, highwaterPath);
      await durableWrite(next);
      // Release only AFTER witness + state + directory sync succeeded.
      // Any I/O or integrity failure has an ambiguous reservation outcome:
      // keep the durable lock until a human operator reconciles the ledger.
      safeToUnlock = true;
      return Object.freeze({
        requests: next.requests,
        reservedUsd: next.reservedMicros / 1_000_000,
        durableOnThisHostOnly: true
      });
    } finally {
      if (safeToUnlock) {
        await unlink(lockPath);
        // A power failure may retain a previously fsynced lock (safe NO-START)
        // but must not restore an earlier spent balance without a lock.
        const lockDirectory = await open(directory, READ_ONLY);
        try { await lockDirectory.sync(); } finally { await lockDirectory.close(); }
      }
    }
  }

  return Object.freeze({
    ready, reserve, inspectReadOnly, markOutcomeUncertain,
    beginPaidDispatch, completePaidDispatch, assertPaidDispatchStillValid
  });
}

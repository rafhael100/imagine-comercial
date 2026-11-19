import {
  open, lstat, realpath, rename, unlink
} from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';

const SCHEMA = 'faisca.private-local-reservations.v1';
const STATE_NAME = 'faisca-reservations.json';
const LOCK_NAME = '.faisca-reservations.lock';
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

  async function checkDirectory() {
    const dir = await lstat(directory);
    if (!dir.isDirectory() || dir.isSymbolicLink() || (dir.mode & 0o077) ||
        (typeof process.getuid === 'function' && dir.uid !== process.getuid()) ||
        await realpath(directory) !== directory) {
      throw new Error('Private ledger directory must be owned, real and mode 0700.');
    }
  }

  async function readState() {
    let file;
    try {
      file = await open(statePath, READ_ONLY);
    } catch (error) {
      if (error.code === 'ENOENT') return {
        schema: SCHEMA, requests: 0, reservedMicros: 0,
        limitRequests: maxRequests, limitMicros
      };
      throw error;
    }
    try {
      const info = await file.stat();
      if (!info.isFile() || info.size > 512 || (info.mode & 0o077) ||
          (typeof process.getuid === 'function' && info.uid !== process.getuid())) {
        throw new Error('Private ledger file has unsafe permissions or shape.');
      }
      const value = JSON.parse(await file.readFile('utf8'));
      if (!value || Object.getPrototypeOf(value) !== Object.prototype ||
          Object.keys(value).sort().join(',') !==
            'limitMicros,limitRequests,requests,reservedMicros,schema' ||
          value.schema !== SCHEMA || value.limitRequests !== maxRequests ||
          value.limitMicros !== limitMicros ||
          !Number.isSafeInteger(value.requests) || value.requests < 0 || value.requests > maxRequests ||
          !Number.isSafeInteger(value.reservedMicros) ||
          value.reservedMicros < 0 || value.reservedMicros > limitMicros) {
        throw new Error('Private ledger requires operator review.');
      }
      return value;
    } finally {
      await file.close();
    }
  }

  async function durableWrite(next) {
    const temp = join(directory, '.faisca-reservation-' + randomUUID() + '.tmp');
    let file;
    try {
      file = await open(temp, OPEN_LOCK, 0o600);
      await file.writeFile(JSON.stringify(next) + '\n');
      await file.sync();
      await file.close();
      file = null;
      await rename(temp, statePath);
      const dir = await open(directory, READ_ONLY);
      try { await dir.sync(); } finally { await dir.close(); }
    } finally {
      await file?.close().catch(() => {});
      await unlink(temp).catch(error => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }

  async function ready() {
    await checkDirectory();
    // Read-only preflight: first reservation creates the ledger atomically.
    return true;
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
    // O_EXCL provides atomic mutual exclusion across processes on ONE host.
    // An existing lock (including a crash remnant) is a hard stop, not a retry.
    let lock;
    try {
      lock = await open(lockPath, OPEN_LOCK, 0o600);
      await lock.close();
      lock = null;
    } catch {
      await lock?.close().catch(() => {});
      throw new Error('Private durable reservation busy or unavailable.');
    }
    try {
      const current = await readState();
      if (current.requests >= maxRequests ||
          current.reservedMicros + micros > limitMicros) {
        throw new Error('Private durable reservation limit reached.');
      }
      const next = {
        ...current, requests: current.requests + 1,
        reservedMicros: current.reservedMicros + micros
      };
      await durableWrite(next);
      return Object.freeze({
        requests: next.requests,
        reservedUsd: next.reservedMicros / 1_000_000,
        durableOnThisHostOnly: true
      });
    } finally {
      await unlink(lockPath);
    }
  }

  return Object.freeze({ ready, reserve });
}

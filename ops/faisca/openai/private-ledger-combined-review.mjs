// R291 — composite private, read-only NO-START diagnostic. This is not
// a transaction, a billing receipt, evidence of installed staging, or a GO.
// No contents of messages, ledger files, markers or credentials are emitted.
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createFaiscaLocalReservationLedger } from './durable-reservation-ledger.mjs';
import { inspectFaiscaLocalPrivateHoldsReadOnly } from './private-ledger-hold-inspection.mjs';

export const FAISCA_COMBINED_LEDGER_REVIEW_SCHEMA =
  'faisca.private-local-ledger-and-holds-review.v1';

const INITIALIZATION_MARKERS = Object.freeze([
  '.faisca-reservations-initialized',
  '.faisca-reservations-highwater-initialized'
]);
const HOLD_FIELDS = Object.freeze([
  'reservationLockPresent',
  'providerDispatchPresent',
  'providerOutcomeUncertainPresent',
  'holdObserved'
]);

async function markerExists(directory, name) {
  try {
    // Presence is only metadata; the ledger validates the real marker body
    // and the high-water witness. Never follow/read this entry here.
    await lstat(join(directory, name));
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw new Error('Private ledger initialization metadata unavailable.');
  }
}
async function initializationPresence(directory) {
  return Promise.all(INITIALIZATION_MARKERS.map(name => markerExists(directory, name)));
}
function equalBooleans(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * A conservative single-host summary. If the ledger cannot be read, keep a
 * sanitized manual-review status instead of inventing zero usage. If the
 * ledger has never been fully initialized, never mistake a zero snapshot for
 * evidence of installation. Concurrent processes may change state at ANY
 * time: this function must never authorize paid dispatch or public access.
 */
export async function reviewFaiscaPrivateLocalLedgerAndHolds({
  directory, maxRequests, maxBudgetUsd
} = {}) {
  // Validate constructor parameters before filesystem reads, without writes.
  const ledger = createFaiscaLocalReservationLedger({
    directory, maxRequests, maxBudgetUsd
  });
  const before = await inspectFaiscaLocalPrivateHoldsReadOnly({ directory });
  const markersBefore = await initializationPresence(directory);
  let snapshot = null;
  try {
    snapshot = await ledger.inspectReadOnly();
  } catch {
    // Fail closed without copying filesystem paths or malformed file bytes.
    snapshot = null;
  }
  const markersAfter = await initializationPresence(directory);
  const after = await inspectFaiscaLocalPrivateHoldsReadOnly({ directory });
  if (!equalBooleans(markersBefore, markersAfter) ||
      HOLD_FIELDS.some(name => before[name] !== after[name])) {
    throw new Error('Private ledger observation changed; review again.');
  }
  const initialized = markersAfter.every(Boolean);
  const readable = initialized && snapshot !== null;
  const ledgerReviewStatus = !initialized
    ? 'uninitialized_or_legacy_requires_review'
    : readable
      ? 'readable_non_atomic'
      : 'manual_review_required';
  return Object.freeze({
    schema: FAISCA_COMBINED_LEDGER_REVIEW_SCHEMA,
    reservationLockPresent: after.reservationLockPresent,
    providerDispatchPresent: after.providerDispatchPresent,
    providerOutcomeUncertainPresent: after.providerOutcomeUncertainPresent,
    holdObserved: after.holdObserved,
    ledgerReviewStatus,
    reservedRequests: readable ? snapshot.requests : null,
    reservedMicros: readable ? snapshot.reservedMicros : null,
    snapshotAtomicAcrossProcesses: false,
    stagingInstallationVerified: false,
    providerUsageReconciled: false,
    canStartPaidCalls: false,
    canReleaseDurableFence: false,
    canResetQuota: false,
    publicReady: false,
    operationalEffects: false
  });
}

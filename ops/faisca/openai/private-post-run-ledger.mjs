import { captureFaiscaLocalLedgerSnapshot, matchFaiscaLocalLedgerDelta } from './private-ledger-sequence-proof.mjs';

// Independent local observation AFTER the operator has stopped the service.
// No socket probe, provider call, ledger mutation or proof of process exit.
export async function inspectFaiscaPrivatePostRunLedger({ ledger } = {}) {
  let snapshot = null, readiness = false;
  try {
    const before = captureFaiscaLocalLedgerSnapshot(await ledger.inspectReadOnly());
    if (before) {
      try { readiness = await ledger.ready() === true; } catch {}
      const after = captureFaiscaLocalLedgerSnapshot(await ledger.inspectReadOnly());
      if (matchFaiscaLocalLedgerDelta(before, after, 0)) snapshot = after;
    }
  } catch {}
  return Object.freeze({
    schema: 'faisca.private-post-run-ledger.v1',
    status: !snapshot ? 'PRIVATE_LOCAL_LEDGER_UNVERIFIED' : readiness
      ? 'PRIVATE_LOCAL_LEDGER_READONLY_READY' : 'PRIVATE_LOCAL_LEDGER_RECONCILIATION_REQUIRED',
    localCountersStable: snapshot !== null,
    localReadinessVerified: snapshot !== null && readiness,
    requests: snapshot?.requests ?? null,
    reservedMicros: snapshot?.reservedMicros ?? null,
    limitRequests: snapshot?.limitRequests ?? null,
    limitMicros: snapshot?.limitMicros ?? null,
    processExitVerified: false,
    providerUsageReconciled: false,
    atomicAcrossProcesses: false,
    operationalEffects: false,
    publicReady: false
  });
}

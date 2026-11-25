import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('R352 rejects mismatched quota configuration before Git, ledger or HTTP', () => {
  const script = fileURLToPath(new URL('../scripts/faisca-private-staging-sequence.mjs', import.meta.url));
  const env = {
    PATH: process.env.PATH,
    FAISCA_PRIVATE_SYNTHETIC_CONVERSATION: 'YES_SYNTHETIC_ONLY',
    FAISCA_PRIVATE_SEQUENCE_ACK: 'YES_NEGATIVE_THEN_POSITIVE_UP_TO_TWO_MODEL_CALLS',
    FAISCA_PRIVATE_LEDGER_AUDIT_ACK: 'YES_LOCAL_READONLY_NO_PROVIDER_PROOF',
    FAISCA_PRIVATE_LEDGER_MAX_REQUESTS: '100',
    FAISCA_PRIVATE_LEDGER_MAX_BUDGET_USD: '10'
  };
  for (const extra of [
    { FAISCA_PRIVATE_LEDGER_MAX_REQUESTS: '99' },
    { FAISCA_PRIVATE_LEDGER_MAX_REQUESTS: '101' },
    { FAISCA_PRIVATE_LEDGER_MAX_REQUESTS: '1e2' },
    { FAISCA_PRIVATE_LEDGER_MAX_BUDGET_USD: '1' },
    { FAISCA_PRIVATE_LEDGER_MAX_BUDGET_USD: '20' },
    { FAISCA_PRIVATE_LEDGER_MAX_BUDGET_USD: '' },
    { FAISCA_PRIVATE_LEDGER_MAX_REQUESTS: '' }
  ]) {
    // A disposable process with no credentials and no ledger directory.
    // It must refuse before any Git, disk or network probe can be started.
    const result = spawnSync(process.execPath, [script, 'a'.repeat(40)], {
      env: { ...env, ...extra }, encoding: 'utf8', timeout: 5000
    });
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr.trim(),
      'R352 BLOCKED: observer limits must match the private server configuration.');
  }
});

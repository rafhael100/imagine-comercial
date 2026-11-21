import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

// R160 private operator CLI: examine only non-sensitive local quota counts.
// This DOES NOT access OpenAI API, contact the VPS, change files or reconcile
// provider bills. The operator separately verifies a clean reviewed SHA.
const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expectedSha = process.argv[2];
const valid = process.argv.length === 3 &&
  /^[0-9a-f]{40}$/u.test(expectedSha ?? '') &&
  !process.env.CI && !process.env.GITHUB_ACTIONS &&
  process.env.FAISCA_PRIVATE_LEDGER_AUDIT_ACK === 'YES_LOCAL_READONLY_NO_PROVIDER_PROOF';

if (!valid) {
  console.error('R160 BLOCKED: private operator, independent SHA and read-only acknowledgment required.');
  process.exitCode = 2;
} else {
  try {
    const head = (await exec('git', ['rev-parse', 'HEAD'], {
      cwd: root, timeout: 3000, maxBuffer: 1024
    })).stdout.trim();
    const dirty = (await exec('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: root, timeout: 3000, maxBuffer: 8192
    })).stdout.trim();
    if (head !== expectedSha || dirty !== '') {
      console.error('R160 BLOCKED: checkout must equal an independently reviewed, clean SHA.');
      process.exitCode = 2;
    } else {
      const ledger = createFaiscaLocalReservationLedger({
        directory: process.env.FAISCA_PRIVATE_LEDGER_DIRECTORY,
        maxRequests: Number(process.env.FAISCA_PRIVATE_LEDGER_MAX_REQUESTS),
        maxBudgetUsd: Number(process.env.FAISCA_PRIVATE_LEDGER_MAX_BUDGET_USD)
      });
      const snapshot = await ledger.inspectReadOnly();
      console.log(JSON.stringify(snapshot, null, 2));
    }
  } catch {
    // No user-supplied path, credentials, file bytes, or error stack in output.
    console.error('R160 BLOCKED: local reservation state unavailable, locked or inconsistent.');
    process.exitCode = 1;
  }
}

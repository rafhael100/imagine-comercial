import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectFaiscaPrivateConversationSequence } from '../ops/faisca/openai/private-staging-sequence.mjs';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reviewedSha = process.argv[2];

const authorized = process.argv.length === 3 &&
  /^[0-9a-f]{40}$/u.test(reviewedSha ?? '') &&
  !process.env.CI && !process.env.GITHUB_ACTIONS &&
  process.env.FAISCA_PRIVATE_SYNTHETIC_CONVERSATION === 'YES_SYNTHETIC_ONLY' &&
  process.env.FAISCA_PRIVATE_SEQUENCE_ACK === 'YES_NEGATIVE_THEN_POSITIVE_UP_TO_TWO_MODEL_CALLS' &&
  process.env.FAISCA_PRIVATE_LEDGER_AUDIT_ACK === 'YES_LOCAL_READONLY_NO_PROVIDER_PROOF';

if (!authorized) {
  console.error('R157 BLOCKED: non-CI operator authorization and independent SHA required.');
  process.exitCode = 2;
} else {
  try {
    const head = (await exec('git', ['rev-parse', 'HEAD'], {
      cwd: root, timeout: 3000, maxBuffer: 1024
    })).stdout.trim();
    const dirty = (await exec('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: root, timeout: 3000, maxBuffer: 8192
    })).stdout.trim();

    if (head !== reviewedSha || dirty !== '') {
      console.error('R157 BLOCKED: checkout must match the separately reviewed, fully clean SHA.');
      process.exitCode = 2;
    } else {
      // Dedicated private review bearer only. Do not read, log or resolve
      // any provider secret; the server must already be provisioned securely.
      // R161: enforce read-only local quota observation for this operator path.
      // Values must match the separately provisioned private server exactly;
      // no ledger reset, mutation, API key lookup, retry or unverified bypass.
      const ledger = createFaiscaLocalReservationLedger({
        directory: process.env.FAISCA_PRIVATE_LEDGER_DIRECTORY,
        maxRequests: Number(process.env.FAISCA_PRIVATE_LEDGER_MAX_REQUESTS),
        maxBudgetUsd: Number(process.env.FAISCA_PRIVATE_LEDGER_MAX_BUDGET_USD)
      });
      const result = await inspectFaiscaPrivateConversationSequence({
        enabled: true,
        reviewToken: process.env.FAISCA_REVIEW_BEARER_TOKEN,
        inspectLedger: () => ledger.inspectReadOnly()
      });
      console.log(JSON.stringify(result, null, 2));
      if (result.status !== 'PRIVATE_SYNTHETIC_SEQUENCE_ENVELOPES_VERIFIED' ||
          result.localLedgerDeltasVerified !== true) {
        process.exitCode = 1;
      }
    }
  } catch {
    console.error('R157 BLOCKED: private sequential staging gate unavailable.');
    process.exitCode = 1;
  }
}

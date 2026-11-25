import { privateStagingGitRevision, privateStagingCleanWorktree } from '../ops/faisca/openai/private-staging-git-evidence.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectFaiscaPrivateConversationSequence } from '../ops/faisca/openai/private-staging-sequence.mjs';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reviewedSha = process.argv[2];

const authorized = process.argv.length === 3 &&
  /^[0-9a-f]{40}$/u.test(reviewedSha ?? '') &&
  !process.env.CI && !process.env.GITHUB_ACTIONS &&
  // The observer is a separate bearer-only process, not the paid server.
  !Object.hasOwn(process.env, 'OPENAI_API_KEY') &&
  process.env.FAISCA_PRIVATE_SYNTHETIC_CONVERSATION === 'YES_SYNTHETIC_ONLY' &&
  process.env.FAISCA_PRIVATE_SEQUENCE_ACK === 'YES_NEGATIVE_THEN_POSITIVE_UP_TO_TWO_MODEL_CALLS' &&
  process.env.FAISCA_PRIVATE_LEDGER_AUDIT_ACK === 'YES_LOCAL_READONLY_NO_PROVIDER_PROOF';

// Match the existing private server and post-run observer exactly. An
// operator typo must not cause a positive HTTP probe with a mismatched
// local quota view. This is not a new cap or a provider billing limit.
const limitsMatch = process.env.FAISCA_PRIVATE_LEDGER_MAX_REQUESTS === '100' &&
  process.env.FAISCA_PRIVATE_LEDGER_MAX_BUDGET_USD === '10';

if (!authorized) {
  console.error('R157 BLOCKED: non-CI bearer-only operator authorization and independent SHA required.');
  process.exitCode = 2;
} else if (!limitsMatch) {
  console.error('R352 BLOCKED: observer limits must match the private server configuration.');
  process.exitCode = 2;
} else {
  try {
    // Reuse the paid preflight's credential-isolated Git subprocesses and
    // raw private-source/index checks. Preserve the observer's stricter
    // rejection of nonignored untracked files anywhere in the checkout.
    const head = await privateStagingGitRevision(root);
    if (head !== reviewedSha || !await privateStagingCleanWorktree(root, { rejectUntracked: true })) {
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
        maxRequests: 100,
        maxBudgetUsd: 10
      });
      const result = await inspectFaiscaPrivateConversationSequence({
        enabled: true,
        reviewToken: process.env.FAISCA_REVIEW_BEARER_TOKEN,
        inspectLedger: () => ledger.inspectReadOnly(),
        inspectReadiness: () => ledger.ready()
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

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateStagingGitRevision, privateStagingCleanWorktree } from '../ops/faisca/openai/private-staging-git-evidence.mjs';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';
import { inspectFaiscaPrivatePostRunLedger } from '../ops/faisca/openai/private-post-run-ledger.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pin = process.argv[2];
const env = process.env;
if (process.argv.length !== 3 || !/^[0-9a-f]{40}$/u.test(pin ?? '') ||
    env.CI || env.GITHUB_ACTIONS || Object.hasOwn(env, 'OPENAI_API_KEY') ||
    Object.hasOwn(env, 'FAISCA_REVIEW_BEARER_TOKEN') ||
    env.FAISCA_PRIVATE_LEDGER_AUDIT_ACK !== 'YES_LOCAL_READONLY_NO_PROVIDER_PROOF' ||
    typeof env.FAISCA_PRIVATE_LEDGER_DIRECTORY !== 'string') {
  console.error('PRIVATE_POST_RUN_BLOCKED: credential-free local audit and independent SHA required.');
  process.exitCode = 2;
} else {
  try {
    if (await privateStagingGitRevision(root) !== pin ||
        !await privateStagingCleanWorktree(root, { rejectUntracked: true })) {
      console.error('PRIVATE_POST_RUN_BLOCKED: reviewed checkout required.');
      process.exitCode = 2;
    } else {
      const ledger = createFaiscaLocalReservationLedger({
        directory: env.FAISCA_PRIVATE_LEDGER_DIRECTORY,
        maxRequests: 100, maxBudgetUsd: 10
      });
      const report = await inspectFaiscaPrivatePostRunLedger({ ledger });
      console.log(JSON.stringify(report, null, 2));
      if (report.status !== 'PRIVATE_LOCAL_LEDGER_READONLY_READY') process.exitCode = 1;
    }
  } catch {
    console.error('PRIVATE_POST_RUN_BLOCKED: local observation unavailable.');
    process.exitCode = 1;
  }
}

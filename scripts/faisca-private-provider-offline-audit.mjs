import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectFaiscaOfflineOperatorAggregate } from '../ops/faisca/openai/private-provider-operator-audit.mjs';
import { createFaiscaIsolatedGitInvocation } from '../ops/faisca/openai/private-operator-git-isolation.mjs';
import { hasFaiscaSafeTrackedIndex } from '../ops/faisca/openai/private-operator-git-index-proof.mjs';
import { hasFaiscaStableOperatorCheckout } from '../ops/faisca/openai/private-operator-checkout-recheck.mjs';

const exec = promisify(execFile);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// R174: inspect the checkout on both sides of the evidence read, using only
// R172's isolated Git process. No output may include paths or Git stdout.
async function inspectCheckout(git) {
  const head = (await exec(git.executable, [...git.prefix, 'rev-parse', 'HEAD'], {
    cwd: repo, timeout: 3000, maxBuffer: 1024, env: git.env
  })).stdout.trim();
  const dirty = (await exec(git.executable, [
    ...git.prefix, 'status', '--porcelain', '--untracked-files=all'
  ], {
    cwd: repo, timeout: 3000, maxBuffer: 8192, env: git.env
  })).stdout.trim();
  // R173: ordinary status is blind to index assume-unchanged/skip-worktree.
  const trackedIndex = (await exec(git.executable, [
    ...git.prefix, 'ls-files', '-v', '-z'
  ], {
    cwd: repo, timeout: 3000, maxBuffer: 2 * 1024 * 1024, env: git.env
  })).stdout;
  return { head, dirty, trackedIndex, indexSafe: hasFaiscaSafeTrackedIndex(trackedIndex) };
}
const [sha, outcome] = process.argv.slice(2);
// SHA-256 pins must come from an independently reviewed channel, not from the
// same untrusted evidence directory. Never print the environment or its values.
let expectedSha256;
try {
  const raw = process.env.FAISCA_PRIVATE_PROVIDER_AUDIT_PINS_JSON;
  if (typeof raw === 'string' && raw.length <= 300) expectedSha256 = JSON.parse(raw);
} catch {
  // Malformed pins fail closed through the acknowledgment check.
}
const acknowledged = expectedSha256 !== undefined && process.argv.length === 4 &&
  /^[0-9a-f]{40}$/u.test(sha ?? '') &&
  ['success', 'rejected', 'failed_luna', 'failed_terra'].includes(outcome) &&
  process.env.FAISCA_PRIVATE_PROVIDER_AUDIT_ACK === 'YES_OFFLINE_NUMERIC_REVIEW_ONLY' &&
  !process.env.CI && !process.env.GITHUB_ACTIONS;

if (!acknowledged) {
  console.error('R167 BLOCKED: private operator, independent SHA and acknowledgment required.');
  process.exitCode = 2;
} else {
  try {
    if (process.platform === 'win32') {
      throw new Error('R172 operator audit requires a POSIX private host.');
    }
    const git = createFaiscaIsolatedGitInvocation();
    const beforeCheckout = await inspectCheckout(git);
    if (!hasFaiscaStableOperatorCheckout(beforeCheckout, beforeCheckout, sha)) {
      console.error('R167 BLOCKED: independently reviewed, clean checkout required.');
      process.exitCode = 2;
    } else {
      const report = await inspectFaiscaOfflineOperatorAggregate({
        directory: process.env.FAISCA_PRIVATE_PROVIDER_AUDIT_DIRECTORY,
        outcome, expectedSha256
      });
      // R174: reject an altered checkout AFTER reading the evidence as well.
      // Never emit a report if the checkout changed during the sensitive read.
      const afterCheckout = await inspectCheckout(git);
      if (!hasFaiscaStableOperatorCheckout(beforeCheckout, afterCheckout, sha)) {
        console.error('R167 BLOCKED: independently reviewed, clean checkout required.');
        process.exitCode = 2;
      } else {
        // Only a fixed-schema result; never echo source JSON, paths or errors.
        console.log(JSON.stringify(report));
        // A matching count always requires independent human review.
        // Exit 2 on pending review, 1 on discrepancy: NEVER public GO.
        process.exitCode = report.status === 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW' ? 2 : 1;
      }
    }
  } catch {
    console.error('R167 BLOCKED: offline evidence unavailable, inconsistent or unsafe.');
    process.exitCode = 1;
  }
}

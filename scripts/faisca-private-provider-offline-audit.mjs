import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectFaiscaOfflineOperatorAggregate } from '../ops/faisca/openai/private-provider-operator-audit.mjs';
import { createFaiscaIsolatedGitInvocation } from '../ops/faisca/openai/private-operator-git-isolation.mjs';
import { hasFaiscaSafeTrackedIndex } from '../ops/faisca/openai/private-operator-git-index-proof.mjs';

const exec = promisify(execFile);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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
    const head = (await exec(git.executable, [...git.prefix, 'rev-parse', 'HEAD'], {
      cwd: repo, timeout: 3000, maxBuffer: 1024, env: git.env
    })).stdout.trim();
    const dirty = (await exec(git.executable, [
      ...git.prefix, 'status', '--porcelain', '--untracked-files=all'
    ], {
      cwd: repo, timeout: 3000, maxBuffer: 8192, env: git.env
    })).stdout.trim();
    // A clean porcelain status is insufficient when Git's index has
    // assume-unchanged or skip-worktree flags that hide tracked edits.
    // Inspect NUL-delimited tracked entries with the same isolated Git.
    const trackedIndex = (await exec(git.executable, [
      ...git.prefix, 'ls-files', '-v', '-z'
    ], {
      cwd: repo, timeout: 3000, maxBuffer: 2 * 1024 * 1024, env: git.env
    })).stdout;
    if (head !== sha || dirty !== '' || !hasFaiscaSafeTrackedIndex(trackedIndex)) {
      console.error('R167 BLOCKED: independently reviewed, clean checkout required.');
      process.exitCode = 2;
    } else {
      const report = await inspectFaiscaOfflineOperatorAggregate({
        directory: process.env.FAISCA_PRIVATE_PROVIDER_AUDIT_DIRECTORY,
        outcome, expectedSha256
      });
      // Only a known fixed-schema result; never echo source JSON, paths, errors or data.
      console.log(JSON.stringify(report));
      // Even matching counts require independent AppSec/LGPD/FinOps/editorial review.
      // Exit 2 on pending review, 1 on discrepancy: NEVER signal public GO.
      process.exitCode = report.status === 'COUNTS_MATCH_PENDING_INDEPENDENT_REVIEW' ? 2 : 1;
    }
  } catch {
    console.error('R167 BLOCKED: offline evidence unavailable, inconsistent or unsafe.');
    process.exitCode = 1;
  }
}

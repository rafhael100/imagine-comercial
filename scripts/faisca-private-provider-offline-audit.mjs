import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectFaiscaOfflineOperatorAggregate } from '../ops/faisca/openai/private-provider-operator-audit.mjs';

const exec = promisify(execFile);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [sha, outcome] = process.argv.slice(2);
const acknowledged = process.argv.length === 4 &&
  /^[0-9a-f]{40}$/u.test(sha ?? '') &&
  ['success', 'rejected', 'failed_luna', 'failed_terra'].includes(outcome) &&
  process.env.FAISCA_PRIVATE_PROVIDER_AUDIT_ACK === 'YES_OFFLINE_NUMERIC_REVIEW_ONLY' &&
  !process.env.CI && !process.env.GITHUB_ACTIONS;

if (!acknowledged) {
  console.error('R167 BLOCKED: private operator, independent SHA and acknowledgment required.');
  process.exitCode = 2;
} else {
  try {
    const head = (await exec('git', ['rev-parse', 'HEAD'], {
      cwd: repo, timeout: 3000, maxBuffer: 1024
    })).stdout.trim();
    const dirty = (await exec('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: repo, timeout: 3000, maxBuffer: 8192
    })).stdout.trim();
    if (head !== sha || dirty !== '') {
      console.error('R167 BLOCKED: independently reviewed, clean checkout required.');
      process.exitCode = 2;
    } else {
      const report = await inspectFaiscaOfflineOperatorAggregate({
        directory: process.env.FAISCA_PRIVATE_PROVIDER_AUDIT_DIRECTORY,
        outcome
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

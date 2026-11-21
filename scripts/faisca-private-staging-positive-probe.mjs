import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectFaiscaPrivatePositiveConversation } from '../ops/faisca/openai/private-staging-positive-probe.mjs';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = process.argv[2];
const authorized = process.argv.length === 3 &&
  /^[0-9a-f]{40}$/u.test(sha ?? '') &&
  !process.env.CI && !process.env.GITHUB_ACTIONS &&
  process.env.FAISCA_PRIVATE_SYNTHETIC_CONVERSATION === 'YES_SYNTHETIC_ONLY' &&
  process.env.FAISCA_PRIVATE_POSITIVE_PROBE_ACK === 'YES_ONE_FICTIONAL_TWO_MODEL_CALLS';

if (!authorized) {
  console.error('R155 BLOCKED: separate SHA, private operator authorization and non-CI context required.');
  process.exitCode = 2;
} else {
  try {
    const head = (await exec('git', ['rev-parse', 'HEAD'], {
      cwd: root, timeout: 3000, maxBuffer: 1024
    })).stdout.trim();
    const dirty = (await exec('git', ['status', '--porcelain', '--untracked-files=no'], {
      cwd: root, timeout: 3000, maxBuffer: 4096
    })).stdout.trim();
    if (head !== sha || dirty !== '') {
      console.error('R155 BLOCKED: checkout must equal the independently reviewed clean HEAD.');
      process.exitCode = 2;
    } else {
      // Dedicated bearer from the private operator environment, never an
      // OpenAI key. No token or response text enters the redacted report.
      const result = await inspectFaiscaPrivatePositiveConversation({
        reviewToken: process.env.FAISCA_REVIEW_BEARER_TOKEN,
        enabled: true
      });
      console.log(JSON.stringify(result, null, 2));
      if (result.status !== 'PRIVATE_POSITIVE_ENVELOPE_VERIFIED') {
        process.exitCode = 1;
      }
    }
  } catch {
    console.error('R155 BLOCKED: private positive staging verification unavailable.');
    process.exitCode = 1;
  }
}

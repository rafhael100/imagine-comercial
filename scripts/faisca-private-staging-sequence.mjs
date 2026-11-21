import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectFaiscaPrivateConversationSequence } from '../ops/faisca/openai/private-staging-sequence.mjs';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reviewedSha = process.argv[2];

const authorized = process.argv.length === 3 &&
  /^[0-9a-f]{40}$/u.test(reviewedSha ?? '') &&
  !process.env.CI && !process.env.GITHUB_ACTIONS &&
  process.env.FAISCA_PRIVATE_SYNTHETIC_CONVERSATION === 'YES_SYNTHETIC_ONLY' &&
  process.env.FAISCA_PRIVATE_SEQUENCE_ACK === 'YES_NEGATIVE_THEN_POSITIVE_UP_TO_TWO_MODEL_CALLS';

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
      const result = await inspectFaiscaPrivateConversationSequence({
        enabled: true,
        reviewToken: process.env.FAISCA_REVIEW_BEARER_TOKEN
      });
      console.log(JSON.stringify(result, null, 2));
      if (result.status !== 'PRIVATE_SYNTHETIC_SEQUENCE_ENVELOPES_VERIFIED') {
        process.exitCode = 1;
      }
    }
  } catch {
    console.error('R157 BLOCKED: private sequential staging gate unavailable.');
    process.exitCode = 1;
  }
}

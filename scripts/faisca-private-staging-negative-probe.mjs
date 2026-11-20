import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectFaiscaPrivateNegativeConversation } from '../ops/faisca/openai/private-staging-negative-probe.mjs';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = process.argv[2];
const valid = process.argv.length === 3 && /^[0-9a-f]{40}$/u.test(sha ?? '') &&
  !process.env.CI && !process.env.GITHUB_ACTIONS &&
  process.env.FAISCA_PRIVATE_SYNTHETIC_CONVERSATION === 'YES_SYNTHETIC_ONLY' &&
  process.env.FAISCA_PRIVATE_NEGATIVE_PROBE_ACK === 'YES_ONE_SYNTHETIC_POST';

if (!valid) {
  console.error('R154 BLOCKED: private operator acknowledgment, independent SHA and non-CI context required.');
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
      console.error('R154 BLOCKED: the tracked checkout does not match the separately reviewed HEAD.');
      process.exitCode = 2;
    } else {
      // The token lives only in a server-side operator environment; never
      // copied from a browser, printed or written to artifacts or GitHub.
      const result = await inspectFaiscaPrivateNegativeConversation({
        reviewToken: process.env.FAISCA_REVIEW_BEARER_TOKEN, enabled: true
      });
      console.log(JSON.stringify(result, null, 2));
      if (result.status !== 'PRIVATE_NEGATIVE_CONVERSATION_VERIFIED') {
        process.exitCode = 1;
      }
    }
  } catch {
    console.error('R154 BLOCKED: private read-only / negative staging verification unavailable.');
    process.exitCode = 1;
  }
}

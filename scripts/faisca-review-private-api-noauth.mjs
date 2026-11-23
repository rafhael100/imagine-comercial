#!/usr/bin/env node
/** R258 operator read-only negative check of the PRIVATE API on localhost:4336. */
import { reviewFaiscaPrivateApiAnonymousBoundary } from
  '../ops/faisca/openai/review-private-api-noauth.mjs';

const HOLD = 'R258: private API anonymous route boundary unverified (HOLD)';
try {
  if (process.argv.length !== 2 || process.env.CI || process.env.GITHUB_ACTIONS ||
      process.env.IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW !== '1') throw Error(HOLD);
  // 4 GET/OPTIONS only. No POST, tokens, prompts or credentials ever sent.
  const report = await reviewFaiscaPrivateApiAnonymousBoundary({ port: 4336 });
  process.stdout.write(JSON.stringify(report) + '\n');
} catch {
  process.stderr.write(HOLD + '\n');
  process.exitCode = 2;
}

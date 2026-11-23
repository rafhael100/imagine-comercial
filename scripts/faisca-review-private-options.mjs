#!/usr/bin/env node
/** R256: operator-only GET/HEAD complement. Fixed OPTIONS to loopback; no auth. */
import { reviewFaiscaPrivateNoAuthPreflight } from
  '../ops/faisca/staging/review-private-preflight-methods.mjs';

const HOLD = 'R256: private OPTIONS boundary unverified (HOLD)';
try {
  if (process.argv.length !== 2 || process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW !== '1') {
    throw Error(HOLD);
  }
  const report = await reviewFaiscaPrivateNoAuthPreflight({ port: 4337 });
  process.stdout.write(JSON.stringify(report) + '\n');
} catch {
  process.stderr.write(HOLD + '\n');
  process.exitCode = 2;
}

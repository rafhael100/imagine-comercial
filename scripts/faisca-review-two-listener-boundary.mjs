#!/usr/bin/env node
/**
 * R260: R259 operator-only boundary with an ABSOLUTE deadline on stdin.
 * A stalled or dripping Docker-inspect input must not hang this local review.
 * No SSH, Docker commands, secrets, POST or OpenAI network calls.
 */
import { TextDecoder } from 'node:util';
import { parseUniquePrivateEvidenceJson } from
  '../ops/faisca/staging/parse-unique-private-evidence-json.mjs';
import { reviewFaiscaPrivateTwoListenerBoundary } from
  '../ops/faisca/staging/review-private-two-listener-boundary.mjs';

const HOLD = 'R259: two-listener private boundary unverified (HOLD)';
const STDIN_DEADLINE_MS = 3000;
try {
  if (process.argv.length !== 2 || process.env.CI || process.env.GITHUB_ACTIONS ||
      process.env.IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW !== '1' ||
      !process.env.IMAGINE_FAISCA_NGINX_IMAGE ||
      !process.env.IMAGINE_FAISCA_STAGING_WORKDIR ||
      !process.env.IMAGINE_FAISCA_STAGING_SITE_DIR ||
      !process.env.IMAGINE_FAISCA_STAGING_HTPASSWD_PATH) throw Error(HOLD);
  const chunks = [];
  let size = 0;
  let expired = false;
  // A byte-size bound alone is insufficient: a partial writer can hold stdin
  // open indefinitely or trickle bytes below the size limit.
  const deadline = setTimeout(() => {
    expired = true;
    process.stdin.destroy(); // No error argument: no diagnostic or payload echo.
  }, STDIN_DEADLINE_MS);
  try {
    for await (const chunk of process.stdin) {
      if (expired) throw Error(HOLD);
      size += chunk.byteLength;
      if (size > 512 * 1024) throw Error(HOLD);
      chunks.push(chunk);
    }
  } finally {
    clearTimeout(deadline);
  }
  if (expired || size < 25) throw Error(HOLD);
  const input = parseUniquePrivateEvidenceJson(new TextDecoder('utf-8', { fatal: true })
    .decode(Buffer.concat(chunks, size)));
  if (!input || Object.getPrototypeOf(input) !== Object.prototype ||
      Object.keys(input).sort().join(',') !== 'container,image' ||
      !Array.isArray(input.container) || input.container.length !== 1 ||
      !Array.isArray(input.image) || input.image.length !== 1) throw Error(HOLD);
  const report = await reviewFaiscaPrivateTwoListenerBoundary({
    container: input.container[0],
    image: input.image[0],
    expectedImage: process.env.IMAGINE_FAISCA_NGINX_IMAGE,
    expectedWorkingDir: process.env.IMAGINE_FAISCA_STAGING_WORKDIR,
    expectedSitePath: process.env.IMAGINE_FAISCA_STAGING_SITE_DIR,
    expectedAuthPath: process.env.IMAGINE_FAISCA_STAGING_HTPASSWD_PATH
  });
  process.stdout.write(JSON.stringify(report) + '\n');
} catch {
  // No operator inputs, credentials, filesystem paths or exception details.
  process.stderr.write(HOLD + '\n');
  process.exitCode = 2;
}

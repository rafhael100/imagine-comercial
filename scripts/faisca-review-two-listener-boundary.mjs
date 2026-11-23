#!/usr/bin/env node
/**
 * R259 private operator CLI. Reads R257 Docker inspect JSON on stdin,
 * then runs 27 fixed, unauthenticated localhost GET/HEAD/OPTIONS requests:
 * Nginx :4337 and the separate private Node API :4336. Never POST,
 * SSH, Docker, OpenAI API calls, token lookup or billable operations.
 */
import { TextDecoder } from 'node:util';
import { reviewFaiscaPrivateTwoListenerBoundary } from
  '../ops/faisca/staging/review-private-two-listener-boundary.mjs';

const HOLD = 'R259: two-listener private boundary unverified (HOLD)';
try {
  if (process.argv.length !== 2 || process.env.CI || process.env.GITHUB_ACTIONS ||
      process.env.IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW !== '1' ||
      !process.env.IMAGINE_FAISCA_NGINX_IMAGE ||
      !process.env.IMAGINE_FAISCA_STAGING_WORKDIR ||
      !process.env.IMAGINE_FAISCA_STAGING_SITE_DIR ||
      !process.env.IMAGINE_FAISCA_STAGING_HTPASSWD_PATH) throw Error(HOLD);
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.byteLength;
    if (size > 512 * 1024) throw Error(HOLD);
    chunks.push(chunk);
  }
  if (size < 25) throw Error(HOLD);
  const input = JSON.parse(new TextDecoder('utf-8', { fatal: true })
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
  // Never echo input, identifiers, host paths, credentials or exceptions.
  process.stderr.write(HOLD + '\n');
  process.exitCode = 2;
}

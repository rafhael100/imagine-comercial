#!/usr/bin/env node
/**
 * R257 operator-only, read-only staging review. No Docker, SSH, secret lookup
 * or paid API use. JSON comes from an already authorized operator inspection.
 * All 23 HTTP probes use fixed, unauthenticated 127.0.0.1:4337 routes.
 */
import { TextDecoder } from 'node:util';
import { reviewFaiscaPrivateFullRuntimeAndCors } from
  '../ops/faisca/staging/review-private-full-runtime-cors.mjs';

const HOLD = 'R257: full private runtime and CORS review unverified (HOLD)';
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
  const report = await reviewFaiscaPrivateFullRuntimeAndCors({
    container: input.container[0],
    image: input.image[0],
    expectedImage: process.env.IMAGINE_FAISCA_NGINX_IMAGE,
    expectedWorkingDir: process.env.IMAGINE_FAISCA_STAGING_WORKDIR,
    expectedSitePath: process.env.IMAGINE_FAISCA_STAGING_SITE_DIR,
    expectedAuthPath: process.env.IMAGINE_FAISCA_STAGING_HTPASSWD_PATH
  });
  process.stdout.write(JSON.stringify(report) + '\n');
} catch {
  // Do not print payloads, host paths, credentials or upstream errors.
  process.stderr.write(HOLD + '\n');
  process.exitCode = 2;
}

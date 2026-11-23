#!/usr/bin/env node
/**
 * R255 operator-only review: full reported Docker runtime and 19 no-auth
 * localhost checks. No Docker, SSH, paid API, registry or secret reads.
 */
import { TextDecoder } from 'node:util';
import { reviewFaiscaPrivateFullRuntimePair } from
  '../ops/faisca/staging/review-private-full-runtime-pair.mjs';

const HOLD = 'R255: full private runtime and HTTP review unverified (HOLD)';
try {
  if (process.argv.length !== 2 || process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW !== '1' ||
      !process.env.IMAGINE_FAISCA_NGINX_IMAGE ||
      !process.env.IMAGINE_FAISCA_STAGING_WORKDIR ||
      !process.env.IMAGINE_FAISCA_STAGING_SITE_DIR ||
      !process.env.IMAGINE_FAISCA_STAGING_HTPASSWD_PATH) throw Error(HOLD);
  const chunks = [];
  let size = 0;
  for await (const part of process.stdin) {
    size += part.byteLength;
    if (size > 512 * 1024) throw Error(HOLD);
    chunks.push(part);
  }
  if (size < 25) throw Error(HOLD);
  const input = JSON.parse(new TextDecoder('utf-8', { fatal: true })
    .decode(Buffer.concat(chunks, size)));
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).length !== 2 ||
      !Object.hasOwn(input, 'container') ||
      !Object.hasOwn(input, 'image') ||
      !Array.isArray(input.container) || input.container.length !== 1 ||
      !Array.isArray(input.image) || input.image.length !== 1) throw Error(HOLD);
  const report = await reviewFaiscaPrivateFullRuntimePair({
    container: input.container[0], image: input.image[0],
    expectedImage: process.env.IMAGINE_FAISCA_NGINX_IMAGE,
    expectedWorkingDir: process.env.IMAGINE_FAISCA_STAGING_WORKDIR,
    expectedSitePath: process.env.IMAGINE_FAISCA_STAGING_SITE_DIR,
    expectedAuthPath: process.env.IMAGINE_FAISCA_STAGING_HTPASSWD_PATH
  });
  process.stdout.write(JSON.stringify(report) + '\n');
} catch {
  process.stderr.write(HOLD + '\n');
  process.exitCode = 2;
}

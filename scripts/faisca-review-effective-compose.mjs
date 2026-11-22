#!/usr/bin/env node
/**
 * R235: inspect operator-piped RESOLVED Compose JSON in private review mode.
 * No Docker commands, writes, external requests, secrets, or deployment.
 * Example (operator workstation only, after independent source/image review):
 * docker compose -f ops/faisca/staging/compose.yaml config --format json |
 *   IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW=1 node scripts/faisca-review-effective-compose.mjs
 *
 * Required environment: IMAGINE_FAISCA_NGINX_IMAGE,
 * IMAGINE_FAISCA_STAGING_SITE_DIR, IMAGINE_FAISCA_STAGING_HTPASSWD_PATH.
 * The operator must compare those values against independently trusted pins.
 */
import { TextDecoder } from 'node:util';
import { resolve } from 'node:path';
import { reviewEffectiveFaiscaStagingCompose } from '../ops/faisca/staging/review-effective-compose.mjs';

const MAX_BYTES = 64 * 1024;
try {
  if (process.env.GITHUB_ACTIONS === 'true' ||
      process.env.IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW !== '1' ||
      process.argv.length !== 2 ||
      !process.env.IMAGINE_FAISCA_NGINX_IMAGE ||
      !process.env.IMAGINE_FAISCA_STAGING_SITE_DIR ||
      !process.env.IMAGINE_FAISCA_STAGING_HTPASSWD_PATH) {
    throw Error('R235: operator-only mode required');
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > MAX_BYTES) throw Error('R235: input too large');
    chunks.push(chunk);
  }
  if (length < 20) throw Error('R235: missing resolved JSON');
  const content = new TextDecoder('utf-8', { fatal: true })
    .decode(Buffer.concat(chunks, length));
  const review = reviewEffectiveFaiscaStagingCompose(JSON.parse(content), {
    expectedImage: process.env.IMAGINE_FAISCA_NGINX_IMAGE,
    expectedSitePath: process.env.IMAGINE_FAISCA_STAGING_SITE_DIR,
    expectedAuthPath: process.env.IMAGINE_FAISCA_STAGING_HTPASSWD_PATH,
    expectedConfigPath: resolve('ops/faisca/staging/nginx.conf')
  });
  process.stdout.write(JSON.stringify(review) + '\n');
} catch {
  // Never echo the untrusted input, paths, environment or credential details.
  process.stderr.write('R235: Faísca effective private Compose not verified (HOLD)\n');
  process.exitCode = 2;
}

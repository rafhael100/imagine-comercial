#!/usr/bin/env node
/**
 * R236 private operator-only read-only JSON inspect reviewer.
 * The caller, not this script, obtains one existing container's "docker inspect"
 * output; this script never runs Docker, never starts a container, and never
 * sends HTTP or accesses a credential file.
 */
import { TextDecoder } from 'node:util';
import { resolve } from 'node:path';
import { reviewRunningFaiscaPrivateContainer } from '../ops/faisca/staging/review-running-container.mjs';

try {
  if (process.env.GITHUB_ACTIONS === 'true' ||
      process.env.IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW !== '1' ||
      process.argv.length !== 2 ||
      !process.env.IMAGINE_FAISCA_NGINX_IMAGE ||
      !process.env.IMAGINE_FAISCA_STAGING_SITE_DIR ||
      !process.env.IMAGINE_FAISCA_STAGING_HTPASSWD_PATH)
    throw Error('R236: operator-only mode');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 256 * 1024) throw Error('R236: input too large');
    chunks.push(chunk);
  }
  if (bytes < 20) throw Error('R236: empty inspect record');
  const parsed = JSON.parse(new TextDecoder('utf-8', { fatal:true })
    .decode(Buffer.concat(chunks, bytes)));
  if (!Array.isArray(parsed) || parsed.length !== 1)
    throw Error('R236: expected exactly one container record');
  const root = resolve('.');
  const review = reviewRunningFaiscaPrivateContainer({
    inspect: parsed[0],
    expectedImage: process.env.IMAGINE_FAISCA_NGINX_IMAGE,
    expectedSitePath: process.env.IMAGINE_FAISCA_STAGING_SITE_DIR,
    expectedAuthPath: process.env.IMAGINE_FAISCA_STAGING_HTPASSWD_PATH,
    expectedWorkingDir: root,
    expectedComposePath: resolve(root, 'ops/faisca/staging/compose.yaml'),
    expectedConfigPath: resolve(root, 'ops/faisca/staging/nginx.conf')
  });
  process.stdout.write(JSON.stringify(review) + '\n');
} catch {
  // Deliberately avoid any error string from Docker output or environment.
  process.stderr.write('R236: running private Faísca not verified (HOLD)\n');
  process.exitCode = 2;
}

#!/usr/bin/env node
/**
 * R239: inspect operator-piped SYNTHETIC or privately obtained Docker JSON.
 * Input: {"container":[<single docker inspect>],"image":[<single docker image inspect>]}
 * Do not send raw inspect output to GitHub, CI, tickets or artifacts.
 * No network, Docker, SSH, registry, filesystem writes or secret logging.
 */
import { TextDecoder } from 'node:util';
import { reviewFaiscaPrivateLocalImageIdentity }
  from '../ops/faisca/staging/review-image-identity.mjs';

const MAX_BYTES = 512 * 1024;
try {
  if (process.env.GITHUB_ACTIONS === 'true' ||
      process.env.IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW !== '1' ||
      process.argv.length !== 2 ||
      !process.env.IMAGINE_FAISCA_NGINX_IMAGE)
    throw Error('R239: operator-only mode required');
  const chunks = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    total += chunk.byteLength;
    if (total > MAX_BYTES) throw Error('R239: input over limit');
    chunks.push(chunk);
  }
  if (total < 25) throw Error('R239: missing JSON');
  const raw = new TextDecoder('utf-8', { fatal: true })
    .decode(Buffer.concat(chunks, total));
  const parsed = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      Object.keys(parsed).length !== 2 ||
      !Object.hasOwn(parsed, 'container') ||
      !Object.hasOwn(parsed, 'image') ||
      !Array.isArray(parsed.container) || parsed.container.length !== 1 ||
      !Array.isArray(parsed.image) || parsed.image.length !== 1)
    throw Error('R239: expected one container and one image');
  const result = reviewFaiscaPrivateLocalImageIdentity({
    container: parsed.container[0],
    image: parsed.image[0],
    expectedImage: process.env.IMAGINE_FAISCA_NGINX_IMAGE
  });
  process.stdout.write(JSON.stringify(result) + '\n');
} catch {
  // Fixed error only: never print untrusted inspect JSON, paths, pins or env.
  process.stderr.write('R239: private Faísca image identity unverified (HOLD)\n');
  process.exitCode = 2;
}

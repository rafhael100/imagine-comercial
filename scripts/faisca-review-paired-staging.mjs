#!/usr/bin/env node
/**
 * R253: operator-only, read-only LOCAL paired-evidence CLI.
 * Input: {"container":[<one docker inspect record>],"image":[<one image inspect>]}
 * The image reference must be obtained from a separately reviewed operator pin.
 * Never pipe raw Docker output to CI, public GitHub, logs or artifacts.
 */
import { TextDecoder } from 'node:util';
import { reviewFaiscaPrivatePairedEvidence }
  from '../ops/faisca/staging/review-private-paired-evidence.mjs';

const HOLD = 'R253: paired private staging evidence unverified (HOLD)';
try {
  const args = process.argv.slice(2);
  let port = 4337;
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--port' ||
      !/^[1-9][0-9]{0,4}$/.test(args[1])) throw Error(HOLD);
    port = Number(args[1]);
    if (!Number.isSafeInteger(port) || port > 65535) throw Error(HOLD);
  }
  if (process.env.GITHUB_ACTIONS === 'true' ||
    process.env.IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW !== '1' ||
    !process.env.IMAGINE_FAISCA_NGINX_IMAGE) throw Error(HOLD);
  const chunks=[];
  let size=0;
  for await (const part of process.stdin) {
    size+=part.byteLength;
    if (size > 512*1024) throw Error(HOLD);
    chunks.push(part);
  }
  if (size < 25) throw Error(HOLD);
  const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true})
    .decode(Buffer.concat(chunks,size)));
  if (parsed === null || typeof parsed !== 'object' ||
    Array.isArray(parsed) || Object.keys(parsed).length !== 2 ||
    !Object.hasOwn(parsed,'container') || !Object.hasOwn(parsed,'image') ||
    !Array.isArray(parsed.container) || parsed.container.length !== 1 ||
    !Array.isArray(parsed.image) || parsed.image.length !== 1) throw Error(HOLD);
  const report = await reviewFaiscaPrivatePairedEvidence({
    container:parsed.container[0],image:parsed.image[0],
    expectedImage:process.env.IMAGINE_FAISCA_NGINX_IMAGE,port
  });
  process.stdout.write(JSON.stringify(report)+'\n');
} catch {
  process.stderr.write(HOLD+'\n');
  process.exitCode=2;
}

#!/usr/bin/env node
/**
 * R242: explicit, READ-ONLY CLI entrypoint for the reviewed no-auth R240/R241
 * loopback probe. Never accepts URLs, hostnames, credentials, cookies or data.
 * A success report is ONLY a local unauthenticated HTTP observation.
 */
import { reviewFaiscaPrivateNoAuthLoopback } from './review-private-http-boundary.mjs';

const HOLD = 'R242: private HTTP probe invocation unverified (HOLD)';
async function main() {
  const args = process.argv.slice(2);
  let port = 4337; // Reviewed Compose mapping: 127.0.0.1:4337:8080.
  if (args.length !== 0) {
    if(args.length !== 2 || args[0] !== '--port' ||
       !/^[1-9][0-9]{0,4}$/.test(args[1])) throw Error(HOLD);
    port = Number(args[1]);
    if (!Number.isSafeInteger(port) || port > 65535) throw Error(HOLD);
  }
  // The underlying probe hard-codes the IPv4 loopback address, exact paths,
  // safe GET/HEAD methods and an absolute per-request deadline.
  const result = await reviewFaiscaPrivateNoAuthLoopback({port});
  process.stdout.write(JSON.stringify({
    ...result,
    evidenceKind:'LOCAL_NOAUTH_LOOPBACK_ONLY',
    examinedPort:port
  })+'\n');
}
try {
  await main();
} catch {
  // Never echo response bytes, headers, request errors or environment values.
  process.stderr.write(HOLD+'\n');
  process.exitCode = 1;
}

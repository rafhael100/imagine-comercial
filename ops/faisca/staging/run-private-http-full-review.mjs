#!/usr/bin/env node
/**
 * R252 — single, read-only entrypoint for the three independently reviewed
 * unauthenticated staging-HTTP probes. This script never takes a hostname,
 * URL, method, route, cookie or credential from an operator.
 */
import {
  reviewFaiscaPrivateNoAuthLoopback,
  reviewFaiscaPrivateNoAuthAliases,
  reviewFaiscaPrivateNoAuthCanonicalization
} from './review-private-http-boundary.mjs';

const HOLD = 'R252: full private no-auth HTTP review unverified (HOLD)';
async function main() {
  const args=process.argv.slice(2);
  let port=4337;
  if(args.length) {
    if(args.length!==2 || args[0]!=='--port' ||
      !/^[1-9][0-9]{0,4}$/.test(args[1])) throw Error(HOLD);
    port=Number(args[1]);
    if(!Number.isSafeInteger(port) || port>65535) throw Error(HOLD);
  }
  // The three probes share only a literal 127.0.0.1 origin. Run all of
  // them; do not emit any partial successful attestations on failure.
  const canonical=await reviewFaiscaPrivateNoAuthLoopback({port});
  const aliases=await reviewFaiscaPrivateNoAuthAliases({port});
  const evasion=await reviewFaiscaPrivateNoAuthCanonicalization({port});
  const parts=[canonical,aliases,evasion];
  if(parts.some(x=>x.observedOnLoopbackOnly!==true ||
    x.noCredentialsSent!==true || x.authenticatedExperienceVerified!==false ||
    x.deploymentAuthorized!==false || x.deploymentPerformed!==false ||
    x.publicFaiscaEnabled!==false)) throw Error(HOLD);
  const total=parts.reduce((n,x)=>n+x.protectedProbeCount,0);
  if(total!==19) throw Error(HOLD);
  process.stdout.write(JSON.stringify({
    schema:'faisca.private-staging-full-noauth-http-review.v1',
    status:'LOCAL_NOAUTH_HTTP_GATES_REVIEW_ONLY',
    evidenceKind:'UNAUTHENTICATED_LOOPBACK_ONLY',
    examinedPort:port,
    canonicalProbes:canonical.protectedProbeCount,
    aliasProbes:aliases.protectedProbeCount,
    noncanonicalProbes:evasion.protectedProbeCount,
    totalProbes:total,
    noCredentialsSent:true,
    authenticatedExperienceVerified:false,
    containerOrVpsIdentityVerified:false,
    externalExposureVerified:false,
    providerSpendReconciled:false,
    publicReady:false,
    deploymentAuthorized:false,
    deploymentPerformed:false,
    publicFaiscaEnabled:false
  })+'\n');
}
try { await main(); }
catch {
  // No raw URL, response headers/body or environment data may be serialized.
  process.stderr.write(HOLD+'\n');
  process.exitCode=1;
}

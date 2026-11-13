#!/usr/bin/env node
/**
 * F258 — one operator command, FIVE read-only evidence checks, no deploy.
 * Preconditions: private staging container ALREADY started by authorized
 * operator, independent package SHA-256 and secrets supplied outside Git.
 * Does not print raw subprocess outputs, URLs, paths, hashes or passwords.
 */
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {evaluateReadOnlyPrivateStagingChain}
  from '../src/lib/private-staging-diagnostic-chain.mjs';

const stages=Object.freeze([
  ['source-and-package','scripts/check-private-staging-prerequisites.mjs',[]],
  ['running-container','scripts/inspect-running-private-staging.mjs',[]],
  ['active-nginx','scripts/check-running-private-nginx.mjs',[]],
  ['full-http','scripts/review-private-staging-operator.mjs',['--port=4321']],
  ['http-methods','scripts/check-private-staging-methods.mjs',['--port=4321']]
]);
let stage='operator-ack';
try{
  if(process.env.GITHUB_ACTIONS==='true'||
    process.env.IMAGINE_PRIVATE_STAGING_REVIEW!=='1'||
    process.argv.length!==2||
    typeof process.env.IMAGINE_STAGING_REVIEW_PASSWORD!=='string'||
    typeof process.env.IMAGINE_EXPECTED_STAGING_TREE_SHA256!=='string'||
    typeof process.env.IMAGINE_STAGING_HTPASSWD_PATH!=='string'||
    typeof process.env.IMAGINE_STAGING_NGINX_IMAGE!=='string')
    throw Error('F258: private operator-only diagnostics');
  const evidence=[];
  for(const [name,script,args] of stages){
    stage=name;
    const r=spawnSync(process.execPath,[script,...args],{
      cwd:resolve('.'),encoding:'utf8',timeout:180000,maxBuffer:128*1024,
      env:process.env
    });
    if(r.error||r.status!==0||!r.stdout||r.stdout.length>128*1024)
      throw Error('F258: required private review failed');
    evidence.push(JSON.parse(r.stdout));
  }
  stage='correlation';
  const report=evaluateReadOnlyPrivateStagingChain({
    preflight:evidence[0],container:evidence[1],
    nginx:evidence[2],http:evidence[3],methods:evidence[4]
  });
  console.log(JSON.stringify(report));
}catch{
  // The stage name is a hardcoded constant. NEVER disclose raw Docker/HTTP
  // output, partial evidence or subprocess stderr (could contain secrets).
  console.error('F258: '+stage+' not verified (HOLD)');
  process.exitCode=2;
}

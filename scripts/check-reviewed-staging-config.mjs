#!/usr/bin/env node
/**
 * F253: no-secret, offline source lock for the PRIVATE staging Compose/Nginx.
 * Runs in GitHub Actions and operator workstations. No Docker/network/write.
 */
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';
import {reviewPrivateStagingConfiguration} from '../src/lib/private-staging-config-lock.mjs';
try{
  if(process.argv.length!==2)throw Error('F253: unsupported arguments');
  const review=reviewPrivateStagingConfiguration({
    compose:readApprovedFile('ops/staging/compose.yaml',16384,'staging compose'),
    nginx:readApprovedFile('ops/staging/nginx.conf',16384,'staging nginx')
  });
  console.log(JSON.stringify(review));
}catch{
  // Never echo an untrusted config value or the operator's environment.
  console.error('F253: private staging source configuration not verified (HOLD)');
  process.exitCode=2;
}

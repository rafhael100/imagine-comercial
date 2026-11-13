#!/usr/bin/env node
/**
 * F256 — operator's read-only inspection of the already-running PRIVATE
 * staging container. No start/stop/recreate/docker exec, no site mutation,
 * no HTTP calls, no client data, no log of paths or Docker JSON.
 */
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';
import {reviewPrivateStagingConfiguration}
  from '../src/lib/private-staging-config-lock.mjs';
import {reviewEffectivePrivateStagingCompose}
  from '../src/lib/effective-staging-compose-review.mjs';
import {reviewRunningPrivateStagingContainer}
  from '../src/lib/running-staging-container-review.mjs';

const MAX=512*1024;
function command(args){
  const r=spawnSync('docker',args,{encoding:'utf8',timeout:20000,
    maxBuffer:MAX,cwd:resolve('.')});
  if(r.error||r.status!==0||!r.stdout||r.stdout.length>MAX)
    throw Error('F256: Docker read-only inspection failed');
  // stderr is never printed, as it might contain a local directory name.
  return r.stdout;
}
try{
  if(process.env.GITHUB_ACTIONS==='true'||
    process.env.IMAGINE_PRIVATE_STAGING_REVIEW!=='1'||
    process.argv.length!==2||
    !process.env.IMAGINE_STAGING_NGINX_IMAGE||
    !process.env.IMAGINE_STAGING_HTPASSWD_PATH)
    throw Error('F256: private operator-only review required');
  const projectRoot=resolve('.');
  const expectedImage=process.env.IMAGINE_STAGING_NGINX_IMAGE;
  const expectedAuthPath=process.env.IMAGINE_STAGING_HTPASSWD_PATH;
  reviewPrivateStagingConfiguration({
    compose:readApprovedFile('ops/staging/compose.yaml',16384,'private compose'),
    nginx:readApprovedFile('ops/staging/nginx.conf',16384,'private nginx')
  });
  const model=JSON.parse(command(['compose','-f','ops/staging/compose.yaml',
    'config','--format','json']));
  reviewEffectivePrivateStagingCompose(model,{
    projectRoot,expectedImage,expectedAuthPath
  });
  const ids=command(['compose','-f','ops/staging/compose.yaml',
    'ps','-q','static-review']).trim().split(/\s+/);
  if(ids.length!==1||!/^[0-9a-f]{12,64}$/.test(ids[0]))
    throw Error('F256: expected exactly one running private staging container');
  const inspected=JSON.parse(command(['inspect','--type','container',ids[0]]));
  if(!Array.isArray(inspected)||inspected.length!==1)
    throw Error('F256: unexpected Docker inspect output');
  const review=reviewRunningPrivateStagingContainer({
    inspect:inspected[0],projectRoot,expectedImage,expectedAuthPath
  });
  console.log(JSON.stringify(review));
}catch{
  console.error('F256: running private staging container not verified (HOLD)');
  process.exitCode=2;
}

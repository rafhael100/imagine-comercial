#!/usr/bin/env node
/**
 * F257: operator-only, read-only validation of Nginx configuration actively
 * loaded in the already running and approved private Compose container.
 * This does NOT start/stop Docker, change config, publish or perform HTTP.
 */
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {TextDecoder} from 'node:util';
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';
import {reviewPrivateStagingConfiguration}
  from '../src/lib/private-staging-config-lock.mjs';
import {reviewEffectivePrivateStagingCompose}
  from '../src/lib/effective-staging-compose-review.mjs';
import {reviewRunningPrivateStagingContainer}
  from '../src/lib/running-staging-container-review.mjs';
import {reviewActivePrivateStagingNginx}
  from '../src/lib/active-private-staging-nginx-review.mjs';

function command(args,maxBytes=524288){
  const output=spawnSync('docker',args,{cwd:resolve('.'),
    timeout:20000,maxBuffer:maxBytes+1024});
  if(output.error||output.status!==0||!output.stdout||
     output.stdout.length>maxBytes)
    throw Error('F257: read-only Docker inspection failed');
  return new TextDecoder('utf-8',{fatal:true})
    .decode(output.stdout);
}
try{
  if(process.env.GITHUB_ACTIONS==='true'||
     process.env.IMAGINE_PRIVATE_STAGING_REVIEW!=='1'||
     process.argv.length!==2||
     !process.env.IMAGINE_STAGING_NGINX_IMAGE||
     !process.env.IMAGINE_STAGING_HTPASSWD_PATH)
    throw Error('F257: restricted operator mode');
  const root=resolve('.');
  const expectedImage=process.env.IMAGINE_STAGING_NGINX_IMAGE;
  const expectedAuthPath=process.env.IMAGINE_STAGING_HTPASSWD_PATH;
  const nginx=readApprovedFile('ops/staging/nginx.conf',16384,'reviewed Nginx');
  reviewPrivateStagingConfiguration({
    compose:readApprovedFile('ops/staging/compose.yaml',16384,'reviewed Compose'),
    nginx
  });
  reviewEffectivePrivateStagingCompose(JSON.parse(command([
    'compose','-f','ops/staging/compose.yaml','config','--format','json'
  ])),{projectRoot:root,expectedImage,expectedAuthPath});
  const ids=command(['compose','-f','ops/staging/compose.yaml',
    'ps','-q','static-review'],2048).trim().split(/\s+/);
  if(ids.length!==1||!/^[a-f0-9]{12,64}$/.test(ids[0]))
    throw Error('F257: expected one live private staging container');
  const inspected=JSON.parse(command(['inspect','--type','container',ids[0]]));
  if(!Array.isArray(inspected)||inspected.length!==1)
    throw Error('F257: invalid Docker inspection');
  reviewRunningPrivateStagingContainer({
    inspect:inspected[0],projectRoot:root,expectedImage,expectedAuthPath
  });
  const dump=command(['exec',ids[0],'nginx','-T']);
  const review=reviewActivePrivateStagingNginx({
    dump,reviewedNginxSource:nginx
  });
  console.log(JSON.stringify(review));
}catch{
  // Never print raw nginx -T (may contain host paths), Docker stderr,
  // host IPs, credentials, image references or document fragments.
  console.error('F257: running Nginx configuration not verified (HOLD)');
  process.exitCode=2;
}

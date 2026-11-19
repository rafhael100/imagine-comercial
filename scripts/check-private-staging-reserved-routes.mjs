#!/usr/bin/env node
/**
 * F293: run ONLY against authorized private staging already listening on
 * 127.0.0.1:4321. Requires independent pinned build SHA and private password.
 * No Docker, DNS, external network, logs, deploy or real visitor input.
 */
import {reviewStagingBuildIntegrity} from '../src/lib/staging-build-integrity.mjs';
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';
import {reviewPrivateStagingReservedRoutes}
  from '../src/lib/private-staging-reserved-routes.mjs';

try{
  if(process.env.GITHUB_ACTIONS==='true'||
    process.env.IMAGINE_PRIVATE_STAGING_REVIEW!=='1'||
    process.argv.length!==3||
    process.argv[2]!=='--port=4321')
    throw Error('F293: private operator-only evidence');
  const password=process.env.IMAGINE_STAGING_REVIEW_PASSWORD;
  if(typeof password!=='string'||password.length<24||
    password.length>128||!/^[\x21-\x7e]+$/.test(password))
    throw Error('F293: strong private reviewer credential required');
  const build=reviewStagingBuildIntegrity({
    root:'dist',expectedTreeSha256:process.env.IMAGINE_EXPECTED_STAGING_TREE_SHA256
  });
  if(build.exactTreeBytesVerified!==true)
    throw Error('F293: pinned build required');
  const expected404Html=readApprovedFile('dist/404.html',1024*1024,
    'private 404 body');
  const basicAuth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
  console.log(JSON.stringify(await reviewPrivateStagingReservedRoutes({
    port:4321,basicAuth,expected404Html
  })));
}catch{
  console.error('F293: private staging reserved-path policy not verified (HOLD)');
  process.exitCode=2;
}

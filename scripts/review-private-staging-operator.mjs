#!/usr/bin/env node
/**
 * F167 — explicit PRIVATE operator check. Reads inputs only from a
 * trusted local environment and makes GET requests solely to 127.0.0.1.
 * Never runs in CI or publishes, logs, deploys or handles actual leads.
 */
import {reviewStagingOperatorCandidate} from '../src/lib/private-staging-operator-review.mjs';

try{
  if(process.env.GITHUB_ACTIONS==='true'||
     process.env.IMAGINE_PRIVATE_STAGING_REVIEW!=='1'||
     process.argv.length!==3||
     !/^--port=[1-9][0-9]{3,4}$/.test(process.argv[2]))
    throw Error('F167: private operator acknowledgment required');
  const port=Number(process.argv[2].slice('--port='.length));
  const password=process.env.IMAGINE_STAGING_REVIEW_PASSWORD;
  if(typeof password!=='string'||password.length<24||password.length>128||
    !/^[\x21-\x7e]+$/.test(password))
    throw Error('F167: strong environment-only reviewer password required');
  const basicAuth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
  const report=await reviewStagingOperatorCandidate({
    root:'dist',
    image:process.env.IMAGINE_STAGING_NGINX_IMAGE,
    expectedTreeSha256:process.env.IMAGINE_EXPECTED_STAGING_TREE_SHA256,
    htpasswdPath:process.env.IMAGINE_STAGING_HTPASSWD_PATH,
    basicAuth,port
  });
  // Never print a password, hash, env ref, Host, pathname or response body.
  console.log(JSON.stringify(report,null,2));
}catch{
  console.error('F167: private staging operator review not verified (HOLD)');
  process.exitCode=2;
}

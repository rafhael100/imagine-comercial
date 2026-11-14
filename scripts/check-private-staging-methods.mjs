#!/usr/bin/env node
/**
 * F292: operator-only read-only HTTP method policy diagnostic.
 * No deployment, commands to Docker, public network, DNS, body logging or PII.
 */
import {reviewPrivateStagingMethodPolicy}
  from '../src/lib/private-staging-method-policy.mjs';

try{
  if(process.env.GITHUB_ACTIONS==='true'||
    process.env.IMAGINE_PRIVATE_STAGING_REVIEW!=='1'||
    process.argv.length!==3||
    process.argv[2]!=='--port=4321')
    throw Error('F292: private operator-only diagnostics');
  const password=process.env.IMAGINE_STAGING_REVIEW_PASSWORD;
  if(typeof password!=='string'||password.length<24||
    password.length>128||!/^[\x21-\x7e]+$/.test(password))
    throw Error('F292: strong private reviewer credential required');
  const basicAuth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
  const report=await reviewPrivateStagingMethodPolicy({port:4321,basicAuth});
  // Only aggregate counts, never request/response bodies, paths or secrets.
  console.log(JSON.stringify(report));
}catch{
  console.error('F292: private staging HTTP method policy not verified (HOLD)');
  process.exitCode=2;
}

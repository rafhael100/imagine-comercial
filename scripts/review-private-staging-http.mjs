#!/usr/bin/env node
/**
 * F159 — run only through a trusted SSH tunnel or a loopback service.
 * Example: IMAGINE_PRIVATE_STAGING_REVIEW=1 node scripts/review-private-staging-http.mjs --port=4321
 * No network routing, DNS, upload, release or deployment commands.
 */
import {reviewPrivateStagingHttp} from '../src/lib/private-staging-http-gate.mjs';

if(process.env.IMAGINE_PRIVATE_STAGING_REVIEW!=='1'||
  process.argv.length!==3||
  !/^--port=[1-9][0-9]{3,4}$/.test(process.argv[2])){
  console.error('F159: private review must be explicitly enabled with --port=NNNN');
  process.exitCode=2;
}else{
  const port=Number(process.argv[2].slice('--port='.length));
  try{
    const report=await reviewPrivateStagingHttp({port});
    console.log(JSON.stringify(report,null,2));
  }catch{
    console.error('F159: private staging evidence not verified (HOLD)');
    process.exitCode=2;
  }
}

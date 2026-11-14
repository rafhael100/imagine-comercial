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
    // Secret supplied only in operator environment, never in CLI args, logs,
    // source files or public GitHub Actions. HTTPS must be provided by SSH.
    const password=process.env.IMAGINE_STAGING_REVIEW_PASSWORD;
    if(typeof password!=='string'||password.length<24||password.length>128||
      !/^[\x21-\x7e]+$/.test(password))
      throw Error('F166: private staging reviewer password required');
    const basicAuth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
    const report=await reviewPrivateStagingHttp({port,basicAuth,fullCoverage:true});
    console.log(JSON.stringify(report,null,2));
  }catch{
    console.error('F159: private staging evidence not verified (HOLD)');
    process.exitCode=2;
  }
}

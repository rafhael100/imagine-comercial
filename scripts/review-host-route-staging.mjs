#!/usr/bin/env node
/**
 * F228: offline operator-only staging HTTP evidence review.
 * No fetch, DNS, cookies, credentials, output files or real 301s.
 */
import {resolve} from 'node:path';
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';
import {buildStagingHostRouteChecklist,reviewStagingHostRouteObservations}
  from '../src/lib/staging-host-route-matrix.mjs';

function run(args,env){
  const synthetic=args.length===1&&args[0]==='--synthetic';
  const privateFile=args.length===2&&args[0]==='--file'&&
    typeof args[1]==='string'&&/\.json$/i.test(args[1]);
  if(!synthetic&&!privateFile)throw Error('F228: unsupported invocation');
  if(privateFile&&env.GITHUB_ACTIONS==='true')
    throw Error('F228: private staging report forbidden in GitHub Actions');
  // Tests deliberately use static synthetic outcomes; no HTTP check occurs.
  const observations=synthetic?buildStagingHostRouteChecklist().map(row=>({
    origin:row.origin,path:row.path,status:row.expectedStatus,
    location:row.expectedLocation,tlsValid:row.expectedTlsValid,
    noindex:row.expectedNoindex
  })):JSON.parse(readApprovedFile(resolve(args[1]),1024*1024,'private host staging JSON'));
  const report=reviewStagingHostRouteObservations(observations);
  // Print aggregate, data-free operational status only.
  console.log('F228 HOST STAGING OFFLINE '+JSON.stringify({
    source:synthetic?'SYNTHETIC_ONLY':'PRIVATE_OPERATOR_UNVERIFIED',
    checks:report.checklistItems,failed:report.failures.length,
    stagingContractPassed:report.passed,
    redirectsAuthorized:report.redirectsAuthorized,
    productionAuthorized:report.productionAuthorized
  }));
  if(!report.passed)process.exitCode=1;
}
try{run(process.argv.slice(2),process.env);}
catch{
  // Never print file path, query/credential, raw JSON or error stack.
  process.stderr.write('F228 staging evidence refused (NO-GO)\n');
  process.exitCode=2;
}

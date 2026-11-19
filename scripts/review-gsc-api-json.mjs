#!/usr/bin/env node
/**
 * F242 — private GSC page JSON review with zero artifact persistence.
 * CI must refuse real inputs. No network, redirects, user data or deploy.
 */
import {resolve} from 'node:path';
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';
import {reviewGscSearchAnalyticsPages} from '../src/lib/gsc-search-analytics-review.mjs';

try{
  if(process.env.GITHUB_ACTIONS==='true')
    throw Error('F242: real private Search Console inputs forbidden in GitHub Actions');
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--file'||
     typeof args[1]!=='string'||!/\.json$/i.test(args[1]))
    throw Error('F242: private JSON file required');
  const source=readApprovedFile(resolve(args[1]),2*1024*1024,'private GSC JSON');
  const payload=JSON.parse(source);
  const report=reviewGscSearchAnalyticsPages(payload);
  // Print ONLY aggregates, never URLs, paths, dimensions, query fragments,
  // labels, siteUrl, raw payload or the full report.
  console.log('GSC private JSON OFFLINE review only: '+JSON.stringify({
    source:'PRIVATE_JSON_NOT_COMMITTED',
    pagesReviewed:report.uniqueRows,
    candidateRows:report.candidateRows,
    heldRows:report.heldRows,
    unknownRows:report.unknownRows,
    approvedRedirects:0,
    productionAuthorized:false,
    artifactsWritten:0
  }));
}catch{
  // Do not forward JS errors that might contain private paths or URL tokens.
  process.stderr.write('GSC private JSON: offline input refused (NO-GO)\n');
  process.exitCode=2;
}

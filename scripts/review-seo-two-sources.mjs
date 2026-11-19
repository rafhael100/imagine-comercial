/**
 * F27 — bounded offline GSC + crawl review with the F224/F242 private boundary.
 * Private inputs never run in GitHub Actions or persist derived artifacts.
 * Synthetic CI retains only the fixed repository fixtures and review output.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {readApprovedFile} from '../src/lib/read-approved-file.mjs';
import {reviewGscPagesCsv} from '../src/lib/gsc-inventory-review.mjs';
import {reviewLegacyCrawlCsv,crossCheckGscAndCrawl} from '../src/lib/crawl-gsc-cross-review.mjs';

function run(args,env){
  const synthetic=args.length===1 && args[0]==='--synthetic';
  const privateRun=args.length===4 && args[0]==='--gsc' && args[2]==='--crawl';
  if(!synthetic&&!privateRun)
    throw new Error('unreviewed invocation');
  // Refuse private mode before opening either input, including missing files.
  if(privateRun&&env.GITHUB_ACTIONS==='true')
    throw new Error('private inputs forbidden in public CI');
  const gscFile=synthetic?'tests/fixtures/gsc-synthetic-pages.csv':args[1];
  const crawlFile=synthetic?'tests/fixtures/crawl-synthetic-pages.csv':args[3];
  if(typeof gscFile!=='string'||typeof crawlFile!=='string'||
     !/\.csv$/i.test(gscFile)||!/\.csv$/i.test(crawlFile))
    throw new Error('CSV files required');
  const gsc=reviewGscPagesCsv(readApprovedFile(resolve(gscFile),2*1024*1024,'GSC CSV'));
  const crawl=reviewLegacyCrawlCsv(readApprovedFile(resolve(crawlFile),2*1024*1024,'crawl CSV'));
  const combined=crossCheckGscAndCrawl(gsc,crawl);
  if(synthetic){
    // Only fixed invented fixtures may create the existing CI review artifacts.
    const out='artifacts/seo-two-source-review';
    mkdirSync(out,{recursive:true});
    writeFileSync(out+'/REVIEW-ONLY-two-source.json',JSON.stringify({
      source:'SYNTHETIC_DATA_ONLY',
      ...combined
    },null,2)+'\n',{mode:0o600});
    const lines=[
      '# Imagine Comercial — evidence review from GSC + crawl',
      '',
      'Data: SYNTHETIC_DATA_ONLY',
      'GSC rows: '+combined.gscCount,
      'Crawl rows: '+combined.crawlCount,
      'Exact host/path matches without query/encoding: '+combined.observedOnBoth,
      'Query/encoded variants held without comparison: '+combined.unmatchablePrivacyVariants,
      'GSC only paths: '+combined.gscOnly.length,
      'Crawl only paths: '+combined.crawlOnly.length,
      'Existing HTTP 3xx redirects needing manual trace: '+combined.existingRedirectsNeedingTrace,
      'Missing / HTTP error paths needing manual history review: '+combined.missingOrFailedNeedingReview,
      'Candidates with two-source evidence only (NOT approved): '+combined.candidatesWithTwoSourceEvidence.length,
      '',
      'APPROVED 301: '+combined.approved301Count,
      'No redirects generated, activated, or deployed.',
      'Manual equivalence, external backlink/GSC and editorial/legal review still required.',
      'Do not upload real Search Console or crawl exports to a public GitHub CI or repository.'
    ];
    writeFileSync(out+'/REVIEW-ONLY-summary.md',lines.join('\n')+'\n',{mode:0o600});
  }
  // Private mode prints only counts. Neither source paths, page URLs,
  // metrics, query values nor detailed comparisons leave this process.
  console.log('SEO dual source OFFLINE review:',JSON.stringify({
    source:synthetic?'SYNTHETIC_DATA_ONLY':'PRIVATE_LOCAL_CSV_ONLY',
    matched:combined.observedOnBoth,gscOnly:combined.gscOnly.length,
    crawlOnly:combined.crawlOnly.length,approvals:combined.approved301Count,
    ...(privateRun?{artifactsWritten:0,productionAuthorized:false}:{})
  }));
}
try{run(process.argv.slice(2),process.env);}
catch{
  // Filesystem/parser exceptions can contain private paths or input bytes.
  process.stderr.write('SEO dual source: offline input refused (NO-GO)\n');
  process.exitCode=2;
}

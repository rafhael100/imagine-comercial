/**
 * F27 — confronto GSC + crawl somente em disco local, NUNCA com API remota.
 * CI sempre usa os dois arquivos SINTÉTICOS em tests/fixtures.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {reviewGscPagesCsv} from '../src/lib/gsc-inventory-review.mjs';
import {reviewLegacyCrawlCsv,crossCheckGscAndCrawl} from '../src/lib/crawl-gsc-cross-review.mjs';

const args=process.argv.slice(2);
const synthetic=args.length===1 && args[0]==='--synthetic';
const privateRun=args.length===4 && args[0]==='--gsc' && args[2]==='--crawl';
if(!synthetic&&!privateRun)
  throw new Error('cross-source: use --synthetic or --gsc /private/Pages.csv --crawl /private/Internal.csv');
const gscFile=synthetic?'tests/fixtures/gsc-synthetic-pages.csv':args[1];
const crawlFile=synthetic?'tests/fixtures/crawl-synthetic-pages.csv':args[3];
if(!/\.csv$/i.test(gscFile)||!/\.csv$/i.test(crawlFile))
  throw new Error('cross-source: CSV files required');
const gsc=reviewGscPagesCsv(readFileSync(resolve(gscFile),'utf8'));
const crawl=reviewLegacyCrawlCsv(readFileSync(resolve(crawlFile),'utf8'));
const combined=crossCheckGscAndCrawl(gsc,crawl);
const out='artifacts/seo-two-source-review';
mkdirSync(out,{recursive:true});
writeFileSync(out+'/REVIEW-ONLY-two-source.json',JSON.stringify({
  source:synthetic?'SYNTHETIC_DATA_ONLY':'PRIVATE_LOCAL_CSV_ONLY',
  ...combined
},null,2)+'\n',{mode:0o600});
const lines=[
  '# Imagine Comercial — evidence review from GSC + crawl',
  '',
  'Data: '+(synthetic?'SYNTHETIC_DATA_ONLY':'PRIVATE_LOCAL_CSV_ONLY'),
  'GSC rows: '+combined.gscCount,
  'Crawl rows: '+combined.crawlCount,
  'Exact host/path/variant matches: '+combined.observedOnBoth,
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
console.log('SEO dual source OFFLINE review:',JSON.stringify({
  source:synthetic?'SYNTHETIC_DATA_ONLY':'PRIVATE_LOCAL_CSV_ONLY',
  matched:combined.observedOnBoth,gscOnly:combined.gscOnly.length,
  crawlOnly:combined.crawlOnly.length,approvals:combined.approved301Count
}));

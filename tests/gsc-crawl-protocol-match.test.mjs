import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewGscPagesCsv} from '../src/lib/gsc-inventory-review.mjs';
import {reviewLegacyCrawlCsv,crossCheckGscAndCrawl} from '../src/lib/crawl-gsc-cross-review.mjs';

const https='https://www.imaginecomunicacao.com.br/fale-conosco.html';
const http='http://www.imaginecomunicacao.com.br/fale-conosco.html';
const gsc=()=>reviewGscPagesCsv('Page\n'+https+'\n'+http+'\n');

test('F153: crawler preserves two protocol-specific response codes for same host/path',()=>{
  const crawl=reviewLegacyCrawlCsv('Address,Status Code\n'+https+',200\n'+http+',301\n');
  assert.equal(crawl.uniqueRows,2);
  assert.equal(crawl.existingRedirects,1);
  assert.deepEqual(crawl.rows.map(x=>x.observedHttp).sort(),[false,true]);
  assert.equal(crawl.rows.find(x=>x.observedHttp).state,'protocol_hold_for_manual_review');
});

test('F153: GSC/Crawl match requires identical scheme; only HTTPS may be a candidate',()=>{
  const crawl=reviewLegacyCrawlCsv('Address,Status Code\n'+https+',200\n'+http+',200\n');
  const report=crossCheckGscAndCrawl(gsc(),crawl);
  assert.equal(report.observedOnBoth,2);
  assert.equal(report.candidatesWithTwoSourceEvidence.length,1);
  assert.equal(report.candidatesWithTwoSourceEvidence[0].observedHttp,false);
  assert.equal(report.conflictingHttpEvidence.length,1);
  assert.equal(report.conflictingHttpEvidence[0].observedHttp,true);
  assert.equal(report.approved301Count,0);
});

test('F153: HTTPS crawl cannot satisfy HTTP GSC evidence for the same URL path',()=>{
  const g=reviewGscPagesCsv('Page\n'+http+'\n');
  const c=reviewLegacyCrawlCsv('Address,Status Code\n'+https+',200\n');
  const review=crossCheckGscAndCrawl(g,c);
  assert.equal(review.observedOnBoth,0);
  assert.equal(review.gscOnly.length,1);
  assert.equal(review.crawlOnly.length,1);
  assert.equal(review.candidatesWithTwoSourceEvidence.length,0);
  assert.equal(review.gscOnly[0].observedHttp,true);
  assert.equal(review.crawlOnly[0].observedHttp,false);
});

test('F153: invalid protocol evidence is denied and private URL tokens remain hidden',()=>{
  const g=gsc(),c=reviewLegacyCrawlCsv('Address,Status Code\n'+https+',200\n');
  const forgedG={...g,rows:[{...g.rows[0],observedHttp:'false'}]};
  const forgedC={...c,rows:[{...c.rows[0],observedHttp:null}]};
  assert.throws(()=>crossCheckGscAndCrawl(forgedG,c),/explicit protocol evidence/);
  assert.throws(()=>crossCheckGscAndCrawl(g,forgedC),/explicit protocol evidence/);
  const secret='LEAD-PERSON-URL-TOKEN-293';
  const review=crossCheckGscAndCrawl(
    reviewGscPagesCsv('Page\n'+http+'?secret='+secret+'\n'),
    reviewLegacyCrawlCsv('Address,Status Code\n'+http+'?secret='+secret+',200\n')
  );
  assert.equal(review.unmatchablePrivacyVariants,2);
  assert.equal(review.candidatesWithTwoSourceEvidence.length,0);
  assert.doesNotMatch(JSON.stringify(review),new RegExp(secret));
});

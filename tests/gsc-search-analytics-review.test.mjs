import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewGscSearchAnalyticsPages} from '../src/lib/gsc-search-analytics-review.mjs';

function example(){
 return {
  siteUrl:'https://www.imaginecomunicacao.com.br/',
  dimensions:['page'],
  rows:[
   {keys:['https://www.imaginecomunicacao.com.br/'],clicks:129,impressions:2145,ctr:0.09,position:3},
   {keys:['https://www.imaginecomunicacao.com.br/fale-conosco.html'],clicks:9,impressions:120},
   {keys:['https://www.imaginecomunicacao.com.br/trabalhe-conosco.html'],clicks:7,impressions:56},
   {keys:['https://www.imaginecomunicacao.com.br/en-us/services/linkedin-ads-anuncios.html'],clicks:0,impressions:13},
   {keys:['https://www.imaginecomunicacao.com.br/fale-conosco.html?token=fictional-customer-secret'],clicks:1,impressions:2}
  ]
 };
}
test('F68 classifies page-dimension GSC rows without exposing performance metrics or tokenized URLs',()=>{
 const report=reviewGscSearchAnalyticsPages(example());
 assert.equal(report.uniqueRows,5);
 assert.equal(report.source,'PRIVATE_GSC_PAGE_ONLY_NO_METRICS');
 assert.equal(report.metricsDiscarded,true);
 assert.equal(report.productionAuthorized,false);
 assert.equal(report.approvedRedirects,0);
 assert.equal(report.candidateRows,1);
 assert.equal(report.heldRows,3);
 assert.equal(report.unknownRows,0);
 const legacy=report.rows.find(row=>row.from==='/trabalhe-conosco.html');
 assert.equal(legacy.state,'legacy_hold_requires_review');
 assert.equal(legacy.proposedTarget,null);
 const english=report.rows.find(row=>row.from==='/en-us/services/linkedin-ads-anuncios.html');
 assert.equal(english.state,'legacy_hold_requires_review');
 const serialized=JSON.stringify(report);
 for(const forbidden of ['clicks','impressions','ctr','position','fictional-customer-secret','129','2145'])
  assert.ok(!serialized.includes(forbidden),forbidden+' must not leak');
 assert.ok(Object.isFrozen(report));
 assert.ok(Object.isFrozen(report.rows));
});
test('F68 GSC exporter cannot accept query dimensions, unrelated projects or malformed rows',()=>{
 const valid=example();
 for(const changed of [
  {...valid,dimensions:['query']},
  {...valid,dimensions:['query','page']},
  {...valid,siteUrl:'https://evil.example/'},
  {...valid,rows:[]},
  {...valid,rows:[{keys:['/foo','/bar']}]},
  {...valid,rows:[{keys:['https://evil.example/foo']}]},
  {...valid,rows:[{keys:['https://www.imaginecomunicacao.com.br/a/../foo']}]},
  {...valid,rows:[{keys:['https://www.imaginecomunicacao.com.br/foo\nbar']}]}
 ]){
  assert.throws(()=>reviewGscSearchAnalyticsPages(changed),
    /invalid private GSC page export|GSC CSV:/);
 }
});
test('F68 GSC domain property is accepted but never publishes any redirects',()=>{
 const payload=example();
 const review=reviewGscSearchAnalyticsPages({
  ...payload,siteUrl:'sc-domain:imaginecomunicacao.com.br'
 });
 assert.equal(review.approvedRedirects,0);
 assert.ok(review.rows.every(row=>row.state!=='approved'));
 assert.ok(review.rows.every(row=>row.proposedTarget===null||
  row.state==='legacy_candidate_requires_approval'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {sitePages} from '../src/data/services.mjs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {buildStagingHostRouteChecklist,reviewStagingHostRouteObservations}
  from '../src/lib/staging-host-route-matrix.mjs';

const plan=()=>buildStagingHostRouteChecklist();
const synthetic=()=>plan().map(x=>({
  origin:x.origin,path:x.path,status:x.expectedStatus,location:x.expectedLocation,
  tlsValid:x.expectedTlsValid,noindex:x.expectedNoindex
}));

test('F227 covers all current and 27 historical paths across four origins',()=>{
  const matrix=plan();
  assert.equal(matrix.length,4*(sitePages.length+legacyUrls.length));
  assert.equal(legacyUrls.length,27);
  assert.equal(matrix.filter(x=>x.category==='LEGACY_CANDIDATE_HOLD').length,20);
  assert.equal(matrix.filter(x=>x.category==='LEGACY_HOLD').length,88);
  assert.ok(matrix.filter(x=>x.category.startsWith('LEGACY_'))
    .every(x=>x.expectedStatus===404&&x.expectedLocation===null&&x.expectedNoindex===true));
  assert.ok(matrix.filter(x=>x.category==='CURRENT_HOST_CANDIDATE')
    .every(x=>x.expectedStatus===301&&x.expectedLocation?.startsWith('https://imaginecomunicacao.com.br/')));
  assert.ok(Object.isFrozen(matrix));
});
test('F227 synthetic matrix matches while all go-live permissions remain denied',()=>{
  const report=reviewStagingHostRouteObservations(synthetic());
  assert.equal(report.passed,true);
  assert.equal(report.failures.length,0);
  assert.equal(report.redirectsAuthorized,0);
  assert.equal(report.productionAuthorized,false);
  assert.equal(report.dnsChangeAuthorized,false);
});
test('F227 catches legacy 301, host redirect chain, TLS and noindex regressions',()=>{
  const cases=[
    [x=>x.category==='LEGACY_CANDIDATE_HOLD', {status:301,location:'https://imaginecomunicacao.com.br/'}],
    [x=>x.category==='LEGACY_HOLD', {noindex:false}],
    [x=>x.category==='CURRENT_HOST_CANDIDATE', {location:'https://www.imaginecomunicacao.com.br/'}],
    [x=>x.category==='CURRENT_CANONICAL', {status:404,noindex:true}],
    [x=>x.category==='CURRENT_CANONICAL', {tlsValid:false}]
  ];
  for(const [pick,change] of cases){
    const observed=synthetic(),idx=plan().findIndex(pick);
    assert.ok(idx>=0);observed[idx]={...observed[idx],...change};
    const result=reviewStagingHostRouteObservations(observed);
    assert.equal(result.passed,false);
    assert.equal(result.failures.length,1);
    assert.equal(result.redirectsAuthorized,0);
  }
});
test('F227 refuses unknown paths, queries, duplicates, missing routes and malicious fields',()=>{
  for(const patch of [
    {path:'/unknown.html'}, {path:'/?session=secret'},
    {origin:'https://imaginecomunicacao.com.br.evil.example'},
    {location:12},{status:NaN},{authorized:true}
  ]){
    const observed=synthetic();observed[0]={...observed[0],...patch};
    assert.throws(()=>reviewStagingHostRouteObservations(observed));
  }
  const duplicate=synthetic();duplicate[1]={...duplicate[0]};
  assert.throws(()=>reviewStagingHostRouteObservations(duplicate));
  assert.throws(()=>reviewStagingHostRouteObservations(synthetic().slice(1)));
});

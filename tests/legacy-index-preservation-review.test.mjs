import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewIndexedLegacyHoldExposure as review} from '../src/lib/legacy-index-preservation-review.mjs';

const url=path=>'https://www.imaginecomunicacao.com.br'+path;
const row=(path,verdict='PASS')=>({url:url(path),verdict});

test('F276 indexed candidate and HOLD legacy pages trigger review without authorizing redirects',()=>{
  const report=review({inspections:[
    row('/o-que-fazemos/marketplace-amazon.html'),
    row('/en-us/'),
    row('/fale-conosco.html'),
    row('/unmapped-legacy-page.html'),
    row('/'),
    row('/en-us/services/linkedin-ads-anuncios.html','NEUTRAL')
  ]});
  assert.equal(report.inspectedUrlVariants,6);
  assert.equal(report.indexedHeldLegacyPaths,2);
  assert.equal(report.indexedCandidateLegacyPaths,1);
  assert.equal(report.indexedUnmappedLegacyPaths,1);
  assert.equal(report.indexedRootHostVariants,1);
  assert.equal(report.otherVerdictsUnresolved,1);
  assert.equal(report.status,'INDEXED_LEGACY_PAGES_REQUIRE_PRESERVATION_REVIEW');
  for(const key of ['sourceCoverageComplete','canRemoveHeldLegacyPages',
    'canonicalHostMigrationApproved','productionAuthorized','deploymentPerformed',
    'privateUrlsOrMetricsPersisted'])assert.equal(report[key],false,key);
  assert.equal(report.redirectsApproved,0);
  assert.ok(Object.isFrozen(report));
  assert.ok(!JSON.stringify(report).includes('marketplace-amazon'));
  assert.ok(!JSON.stringify(report).includes('unmapped-legacy'));
});

test('F276 apex/www equivalent paths count once and protocol/query variants stay held',()=>{
  const report=review({inspections:[
    row('/en-us/'),
    {url:'https://imaginecomunicacao.com.br/en-us/',verdict:'PASS'},
    {url:'http://www.imaginecomunicacao.com.br/en-us/',verdict:'PASS'},
    {url:url('/fale-conosco.html')+'?token=PRIVATE-F276',verdict:'PASS'}
  ]});
  assert.equal(report.indexedHeldLegacyPaths,1);
  assert.equal(report.protocolOrQueryVariantsHeld,2);
  assert.doesNotMatch(JSON.stringify(report),/PRIVATE-F276|en-us/);
  assert.equal(report.productionAuthorized,false);
});

test('F276 samples with no confirmed indexed paths cannot grant go-live',()=>{
  const result=review({inspections:[row('/fale-conosco.html','NEUTRAL')]});
  assert.equal(result.status,'PARTIAL_EVIDENCE_NOT_RELEASE_AUTHORITY');
  assert.equal(result.sourceCoverageComplete,false);
  assert.equal(result.productionAuthorized,false);
});

test('F276 malformed, external and sensitive records are rejected without echoing URL',()=>{
  for(const input of [
    {inspections:[]},
    {inspections:[row('/fale-conosco.html'),row('/fale-conosco.html')]},
    {inspections:[{url:'https://evil.example/PRIVATE-F276',verdict:'PASS'}]},
    {inspections:[{...row('/fale-conosco.html'),clicks:10}]},
    {inspections:[row('/fale-conosco.html','INDEXED')]},
    {inspections:[{url:url('/a/../fale-conosco.html'),verdict:'PASS'}]}
  ]){
    try{review(input);assert.fail('must refuse');}
    catch(e){assert.doesNotMatch(String(e),/PRIVATE-F276|evil.example/);}
  }
});

test('F276 untrusted property accessors are rejected before getters execute',()=>{
  let calls=0;
  const bad=row('/fale-conosco.html');
  Object.defineProperty(bad,'verdict',{enumerable:true,
    get(){calls++;throw Error('PRIVATE-F276-GETTER');}
  });
  assert.throws(()=>review({inspections:[bad]}),/invalid private inspection row/);
  assert.equal(calls,0);
});

test('F276 CLI never prints raw inspection URLs or touches public CI',()=>{
  const source=readFileSync(
    new URL('../scripts/review-private-gsc-index-holds.mjs',import.meta.url),'utf8');
  assert.match(source,/GITHUB_ACTIONS==='true'/);
  assert.match(source,/readApprovedFile/);
  assert.match(source,/reviewIndexedLegacyHoldExposure/);
  assert.doesNotMatch(source,/fetch\s*\(|writeFile|console\.log\([^)]*source|console\.log\([^)]*inspections/);
});

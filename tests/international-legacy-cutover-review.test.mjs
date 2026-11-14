import assert from 'node:assert/strict';
import {test} from 'node:test';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {sitePages} from '../src/data/services.mjs';
import {reviewInternationalLegacyCutover} from '../src/lib/international-legacy-cutover-review.mjs';

test('old English URLs have audited retention coverage without authorizing 301',()=>{
  const report=reviewInternationalLegacyCutover();
  const known=legacyUrls.filter(x=>x.from.startsWith('/en-us/'));
  assert.equal(report.originalsReviewed,known.length);
  assert.equal(report.originalsReviewed,12);
  assert.equal(report.editorialEquivalentsProposed,5);
  assert.equal(report.originalsWithoutEquivalent,7);
  assert.deepEqual(report.entries.map(x=>x.from).sort(),known.map(x=>x.from).sort());
  assert.ok(report.entries.every(x=>x.state==='HOLD_RETAIN_ORIGINAL_UNTIL_INDEPENDENT_APPROVAL'));
  assert.ok(known.every(x=>x.status==='hold'&&x.to===null));
  assert.equal(report.redirectsAuthorized,0);
  assert.equal(report.redirectsGenerated,0);
  assert.equal(report.readyForCutover,false);
  assert.equal(report.canReplaceLegacyEnglishSite,false);
  assert.equal(report.legalAndEditorialApproval,false);
  assert.equal(report.legacyContentPreservedInProductionVerified,false);
  assert.equal(report.GSCAndBacklinkCoverageVerified,false);
  assert.equal(report.networkPerformed,false);
  assert.ok(Object.isFrozen(report)&&Object.isFrozen(report.entries));
});
test('candidate editorial equivalents are all real English pages with no legal or portfolio replacement',()=>{
  const report=reviewInternationalLegacyCutover();
  const published=new Set(sitePages.map(x=>x.path));
  for(const entry of report.entries){
    if(entry.possibleNewPage===null)continue;
    assert.match(entry.possibleNewPage,/^\/en\//);
    assert.ok(published.has(entry.possibleNewPage),entry.from);
  }
  assert.equal(report.entries.find(x=>x.from==='/en-us/').possibleNewPage,'/en/');
  assert.equal(report.entries.find(x=>x.from==='/en-us/contact-us.html').possibleNewPage,'/en/contact/');
  for(const path of ['/en-us/customers.html','/en-us/termos-de-uso.html',
    '/en-us/services/youtube-ads-anuncios.html',
    '/en-us/services/criacao-de-loja-virtual.html',
    '/en-us/services/linkedin-ads-anuncios.html',
    '/en-us/services/marketplace-amazon.html',
    '/en-us/services/marketplace-mercado-livre.html']){
    assert.equal(report.entries.find(x=>x.from===path)?.possibleNewPage,null,path);
  }
});

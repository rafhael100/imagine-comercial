import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from '../src/data/services.mjs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {
  legacyPublicOfferingHeadings as headings,
  reviewLegacyPublicOfferings
} from '../src/data/legacy-public-offerings.mjs';
import {renderReadinessReport} from '../scripts/report-launch-blockers.mjs';

test('F172 14 publicly observed legacy headings are review items, never approved product scope',()=>{
  assert.equal(headings.length,14);
  assert.equal(new Set(headings.map(x=>x.label)).size,14);
  assert.equal(headings.filter(x=>x.status==='CANDIDATE_REVIEW_NOT_EQUIVALENT').length,4);
  assert.equal(headings.filter(x=>x.status==='HOLD_UNMAPPED').length,10);
  for(const item of headings){
    assert.ok(Object.isFrozen(item));
    assert.match(item.label,/\S/);
    if(item.possibleSlug)assert.ok(services.some(x=>x.slug===item.possibleSlug));
    else assert.equal(item.status,'HOLD_UNMAPPED');
  }
});
test('F172 6 public catalog slugs do not hide 10 old categories or 2 new-only scope reviews',()=>{
  const report=reviewLegacyPublicOfferings();
  assert.equal(report.legacyHeadingsObserved,14);
  assert.equal(report.candidatesRequiringManualEquivalence,4);
  assert.equal(report.unmappedLegacyHeadings,10);
  assert.equal(report.newCatalogSlugsRequiringScopeReview,2);
  assert.deepEqual([...report.newOnlySlugs].sort(),
    ['onepage','sites-por-assinatura'].sort());
  assert.ok(report.heldHeadings.includes('Criação de Loja Virtual'));
  assert.ok(report.heldHeadings.includes('Sistemas Personalizados'));
  assert.equal(report.contentScopeOwnerApproved,false);
  assert.equal(report.legacyToNewEquivalenceVerified,false);
  assert.equal(report.oldOfferingsStillSoldVerified,false);
  assert.equal(report.seoRedirectsAuthorized,false);
  assert.equal(report.productionCatalogReplacementAuthorized,false);
  assert.equal(report.deploymentAuthorized,false);
  assert.ok(Object.isFrozen(report));
  for(const prop of ['candidateSlugs','heldHeadings','newOnlySlugs'])
    assert.ok(Object.isFrozen(report[prop]));
});
test('F172 scope catalog cannot silently authorize known redirects or runtime',()=>{
  assert.equal(legacyUrls.filter(x=>x.status==='candidate').length,5);
  assert.equal(legacyUrls.filter(x=>x.status==='hold').length,22);
  assert.ok(legacyUrls.every(x=>x.status!=='approved'));
  for(const args of [[],['--target=staging']]){
    const report=JSON.parse(renderReadinessReport(args));
    assert.equal(report.legacyPublicServiceScope.unmappedLegacyHeadings,10);
    assert.equal(report.legacyPublicServiceScope.contentScopeOwnerApproved,false);
    assert.ok(report.blockers.includes('content-brand-contacts-pricing'));
    assert.ok(report.blockers.includes('gsc-real-crawl-and-redirect-review'));
    assert.equal(report.approval,'NOT_AUTHORIZED');
    assert.equal(report.deploymentPerformed,false);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sitePages} from '../src/data/services.mjs';
import {reviewProgressiveOverlayManifest} from '../src/lib/progressive-legacy-overlay-plan.mjs';
import {buildPublicSitemapPreservationReview} from '../src/lib/legacy-public-sitemap-review.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
function plan(){
 const file=path=>({path,size:1000,sha256:hash(path)});
 const files=[
  ...sitePages.map(page=>file(page.path==='/'?'index.html':page.path.slice(1)+'index.html')),
  ...['404.html','robots.txt','sitemap.xml','logo-imagine.png',
  '_astro/BaseLayout.contenthash.css',
  '_astro/InternationalBudgetCalculator.contenthash.js'].map(file)
 ];
 return reviewProgressiveOverlayManifest({
  schema:'imagine.comercial.release-review.v1',
  mode:'REVIEW_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
  origin:'https://imaginecomunicacao.com.br/',htmlPages:63,
  fileCount:files.length,totalBytes:files.length*1000,
  treeSha256:hash('synthetic review'),files
 });
}
test('F359 frozen public sitemap review contains 81 HOLD rows and exactly two Astro collisions',()=>{
 const review=buildPublicSitemapPreservationReview(plan());
 assert.equal(review.rows.length,81);
 assert.equal(review.protectedPathVariants,161);
 assert.equal(review.directAstroCollisions,1);
 assert.equal(review.slashVariantAstroCollisions,1);
 assert.equal(review.astroCandidatePages,61);
 assert.deepEqual(review.rows.filter(x=>x.astroExactCollision).map(x=>x.path),['/']);
 assert.deepEqual(review.rows.filter(x=>x.astroSlashVariantCollision).map(x=>x.path),['/contato']);
 assert.equal(review.rows.filter(x=>x.redirectAuthorized).length,0);
 assert.equal(review.rows.every(x=>x.exactDecision==='LEGACY_ORIGIN_RETAIN'&&
  x.slashDecision==='LEGACY_ORIGIN_RETAIN'&&
  x.httpStatusCheckedByThisOfflineReview===false&&x.formDeliveryVerified===false),true);
 assert.equal(review.actualNetworkPerformed,false);
 assert.equal(review.deploymentAuthorized,false);
 assert.equal(review.redirectsAuthorized,0);
 assert.ok(Object.isFrozen(review)&&Object.isFrozen(review.rows));
});
test('F359 refuses fabricated or mutable route plans, without executing network',()=>{
 const good=plan();
 const fake=structuredClone(good);
 assert.throws(()=>buildPublicSitemapPreservationReview(fake),/F359:/);
 assert.throws(()=>buildPublicSitemapPreservationReview({...good,redirectsAuthorized:1}),/F359:/);
 assert.throws(()=>buildPublicSitemapPreservationReview(null),/F359:/);
});

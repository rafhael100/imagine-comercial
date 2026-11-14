/**
 * F314 — manifest-only, read-only preview for future origin-preserving
 * staged migration. Uses the exact compiled public Astro tree proven by
 * release integrity CI, never contacts either origin or deploys an edge.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {readProtectedDist} from '../src/lib/read-protected-dist.mjs';
import {reviewStagingBuildIntegrity} from '../src/lib/staging-build-integrity.mjs';
import {reviewProgressiveOverlayManifest,classifyProgressiveOverlayRequest}
 from '../src/lib/progressive-legacy-overlay-plan.mjs';
import {sitePages} from '../src/data/services.mjs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';

const manifest=JSON.parse(await readFile(
 'artifacts/release-review/REVIEW-ONLY-static-build-sha256.json','utf8'));
const integrity=reviewStagingBuildIntegrity({
 root:'dist',expectedTreeSha256:manifest.treeSha256
});
assert.equal(integrity.exactTreeBytesVerified,true);
const candidate=reviewProgressiveOverlayManifest(manifest);
const decisions=sitePages.map(page=>classifyProgressiveOverlayRequest(candidate,{
 method:'GET',pathname:page.path,search:''
}));
assert.equal(decisions.filter(d=>d.decision==='REVIEWED_NEW_ASTRO_HTML').length,59);
assert.equal(decisions.filter(d=>d.decision==='LEGACY_ORIGIN_RETAIN').length,1);
for(const item of legacyUrls){
 const record=classifyProgressiveOverlayRequest(candidate,{
  method:'GET',pathname:item.from,search:''
 });
 assert.equal(record.decision,'LEGACY_ORIGIN_RETAIN');
}
for(const candidateAsset of candidate.eligibleStaticAssets){
 const record=classifyProgressiveOverlayRequest(candidate,{
  method:'GET',pathname:candidateAsset,search:''
 });
 assert.equal(record.decision,'REVIEWED_NEW_ASTRO_ASSET');
}
const allowedAssets=new Set(candidate.eligibleStaticAssets);
const pages=readProtectedDist('dist').filter(item=>item.path.endsWith('index.html'));
assert.equal(pages.length,60);
let referencedAssets=0;
for(const page of pages){
 const html=page.bytes.toString('utf8');
 const srcs=[...html.matchAll(/(?:src|href)="(\/_astro\/[^"]+|\/logo-imagine\.png)"/g)];
 assert.ok(srcs.length>0,'F314: HTML must reference a reviewed asset');
 for(const match of srcs){
  assert.ok(allowedAssets.has(match[1]),'F314: unlisted deployed static asset');
  referencedAssets++;
 }
}
assert.ok(referencedAssets>=60,'F314: expected all pages to reference reviewed resources');
const handoff=Object.freeze({
 schema:'imagine.comercial.progressive-legacy-overlay-handoff.v1',
 status:'REVIEW_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
 staticTreeSha256:manifest.treeSha256,
 reviewContract:candidate.schema,
 publicPagesBuilt:60,
 newPagesEligibleForPrivateOverlay:59,
 retainedOriginalHomepageCount:1,
 retainedKnownOldUrls:27,
 retainedLegacyHeld:22,
 retainedLegacyRedirectCandidates:5,
 reviewedNewAssets:candidate.eligibleStaticAssets.length,
 referencedNewAssetsChecked:referencedAssets,
 originalSitemapAndRobotsRetained:true,
 mutatingHttpRequestsMustUseOriginal:true,
 unlistedPathsMustUseOriginal:true,
 futurePrivateOverlayRequiresOriginSeparation:true,
 futurePrivateOverlayRequiresAllRoutesNoindex:true,
 mixedHomepageHreflangSeoReady:false,
 originalFormLeadDeliveryVerified:false,
 legacyOriginActuallyReachable:false,
 newOriginActuallyReachable:false,
 noProxyOrHostNamesGenerated:true,
 redirectsAuthorized:0,
 releaseAuthority:false,
 deployPerformed:false
});
await writeFile('artifacts/release-review/REVIEW-ONLY-progressive-legacy-overlay.json',
 JSON.stringify(handoff,null,2)+'\n');
console.log('PASS F314: preview only; 59 Astro routes, 27 old and original home preserved, '+
 candidate.eligibleStaticAssets.length+' approved assets. Private staging/noindex only, no deploy.');

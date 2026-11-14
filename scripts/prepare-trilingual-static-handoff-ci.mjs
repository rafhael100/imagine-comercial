/**
 * CI-only immutable static bundle handoff for independent private preview.
 * Reads actual Astro bytes and existing integrity manifest. Does not perform
 * deploy, DNS changes, 301s, credential access, provider billing or approvals.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {sitePages} from '../src/data/services.mjs';
import {
 INTERNATIONAL_LANGUAGES,INTERNATIONAL_SECTIONS,languageAlternates
} from '../src/data/i18n.mjs';
import {
 INTERNATIONAL_ARTICLE_SLUGS
} from '../src/data/i18n-articles.mjs';
import {renderReadinessReport} from './report-launch-blockers.mjs';
import {reviewStagingBuildIntegrity} from '../src/lib/staging-build-integrity.mjs';

const manifest=JSON.parse(await readFile(
 'artifacts/release-review/REVIEW-ONLY-static-build-sha256.json','utf8'));
const readiness=JSON.parse(renderReadinessReport(['--target=production']));
const staticPaths=sitePages.map(p=>p.path);
const translated=staticPaths.filter(p=>/^\/(?:en|es)\//.test(p));
const portuguese=staticPaths.filter(p=>!/^\/(?:en|es)\//.test(p));
assert.equal(staticPaths.length,60,'Trilingual release must have 60 reviewed public HTML pages');
assert.equal(portuguese.length,20,'Existing Portuguese pages plus the reviewed calculator must be retained');
assert.equal(translated.length,40,'Twenty pages per international language required');
assert.equal(INTERNATIONAL_ARTICLE_SLUGS.length,5,'All five original guides must have parity');
assert.equal(INTERNATIONAL_SECTIONS.length,20);
assert.deepEqual(INTERNATIONAL_LANGUAGES,['en','es']);
assert.equal(manifest.mode,'REVIEW_ONLY_NOT_AUTHORIZED_FOR_DEPLOY');
assert.equal(manifest.htmlPages,60);
assert.equal(manifest.origin,'https://imaginecomunicacao.com.br/');
assert.match(manifest.treeSha256,/^[0-9a-f]{64}$/);
const integrity=reviewStagingBuildIntegrity({
 root:'dist',expectedTreeSha256:manifest.treeSha256
});
assert.equal(integrity.exactTreeBytesVerified,true);
assert.equal(integrity.deploymentAuthorized,false);
for(const path of staticPaths){
  const alternate=languageAlternates(path);
  if(!alternate)throw Error('Untranslated or unreviewed public SEO path: '+path);
  assert.ok(staticPaths.includes(alternate['pt-BR']));
  assert.ok(staticPaths.includes(alternate.en));
  assert.ok(staticPaths.includes(alternate.es));
  assert.equal(alternate['x-default'],alternate['pt-BR']);
}
assert.equal(readiness.approval,'NOT_AUTHORIZED');
assert.equal(readiness.deploymentPerformed,false);
assert.equal(readiness.legacyCutover.canReplaceLegacySite,false);
const englishLegacy=readiness.internationalLegacyCutover;
assert.equal(englishLegacy.originalsReviewed,12);
assert.equal(englishLegacy.editorialEquivalentsProposed,5);
assert.equal(englishLegacy.originalsWithoutEquivalent,7);
assert.equal(englishLegacy.redirectsGenerated,0);
assert.equal(englishLegacy.redirectsAuthorized,0);
assert.equal(englishLegacy.readyForCutover,false);
assert.equal(englishLegacy.legalAndEditorialApproval,false);
const legacyHttp=readiness.legacyHttpContinuity;
assert.equal(legacyHttp.totalKnownRoutes,27);
assert.equal(legacyHttp.heldMustBePreserved,22);
assert.equal(legacyHttp.redirectCandidatesRequireEditorialReview,5);
assert.equal(legacyHttp.originalPublicHttpSnapshotIndependentlyReviewed,false);
assert.equal(legacyHttp.candidatePrivateHttpSnapshotIndependentlyReviewed,false);
assert.equal(legacyHttp.historicalFormsAndLeadsDeliveryVerified,false);
assert.equal(legacyHttp.readyToReplaceLegacySite,false);

const record={
 schema:'imagine.comercial.trilingual-static-review-handoff.v1',
 status:'READY_FOR_INDEPENDENT_REVIEW_NOT_READY_FOR_DEPLOY',
 origin:'https://imaginecomunicacao.com.br/',
 sourceCommit:process.env.GITHUB_SHA&&/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA)
    ?process.env.GITHUB_SHA:null,
 staticTreeSha256:manifest.treeSha256,
 staticFileCount:manifest.fileCount,
 totalBytes:manifest.totalBytes,
 portuguesePages:portuguese.length,
 englishPages:translated.filter(p=>p.startsWith('/en/')).length,
 spanishPages:translated.filter(p=>p.startsWith('/es/')).length,
 editorialGuidesPerLanguage:INTERNATIONAL_ARTICLE_SLUGS.length,
 allThreeLanguagesHaveRealPublishedCounterparts:true,
 publicIntakeOrPaymentAuthorized:false,
 legacyEnglishUrlsProtected:englishLegacy.originalsReviewed,
 englishLegacyPossibleMappingsOnly:englishLegacy.editorialEquivalentsProposed,
 englishLegacyHeldWithoutEquivalent:englishLegacy.originalsWithoutEquivalent,
 legacyHttpOriginalObserved:false,
 legacyHttpCandidateObserved:false,
 historicalFormsAndLeadsDeliveryVerified:false,
 heldLegacyPathsRequiringContinuity:22,
 totalLegacyPathsRequiringReview:27,
 redirectsAuthorized:0,
 publishOrRedirectPerformed:false,
 independentHashAttestationVerified:false,
 releaseOwnerAuthorizationVerified:false,
 hostingAccessVerified:false,
 liveHttpVerified:false,
 rollbackDrillVerified:false,
 privacyLegalApprovalVerified:false,
 deploymentAuthorized:false,
 blockers:readiness.blockers
};
assert.equal(record.englishPages,20);
assert.equal(record.spanishPages,20);
await writeFile('artifacts/release-review/REVIEW-ONLY-i18n-static-handoff.json',
 JSON.stringify(record,null,2)+'\n');
console.log('PASS: 60 public Astro pages + custom 404, 20 each PT, EN and ES; complete hreflang triplets; SHA-256 matched. REVIEW ONLY.');

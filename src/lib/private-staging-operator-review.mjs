/**
 * F167 — single, non-deploying operator review of PRIVATE staging.
 * Requirements are independently checked by F164/F165/F166/F159.
 * A passing report is diagnostic evidence only; none of the checks
 * proves public production authorization or remote tenant privacy.
 */
import {reviewPrivateStagingImage} from './private-staging-image-policy.mjs';
import {reviewStagingBuildIntegrity} from './staging-build-integrity.mjs';
import {reviewPrivateStagingHtpasswd} from './private-staging-htpasswd-review.mjs';
import {reviewPrivateStagingHttp} from './private-staging-http-gate.mjs';
import {sitePages} from '../data/services.mjs';
import {legacyUrls} from '../data/legacy-urls.mjs';

export async function reviewStagingOperatorCandidate({
  root,image,expectedTreeSha256,htpasswdPath,basicAuth,port,transport
}={}){
  // Order matters: reject local package or secret problems BEFORE network.
  const imageReview=reviewPrivateStagingImage(image);
  const bytes=reviewStagingBuildIntegrity({root,expectedTreeSha256});
  const authFile=reviewPrivateStagingHtpasswd(htpasswdPath);
  if(!imageReview.immutableDigestSyntax||!bytes.exactTreeBytesVerified||
     !authFile.filePermissionsPrivate||!authFile.bcryptHashSyntaxPresent)
    throw Error('F167: private staging prerequisites not satisfied');
  // F232: the operator's final decision must check every current and historical
  // path, not only the smaller smoke-test fixture.
  const http=await reviewPrivateStagingHttp({port,basicAuth,transport,fullCoverage:true});
  const publicCount=sitePages.length;
  const legacyCount=legacyUrls.length;
  const anonymousCount=publicCount+legacyCount+3; // SEO resources and private asset sentinel
  // F233: verify the package a second time AFTER the HTTP review. A local
  // file mutation during an otherwise successful session must fail closed.
  const stableBytes=reviewStagingBuildIntegrity({root,expectedTreeSha256});
  if(stableBytes.fileCount!==bytes.fileCount||
     stableBytes.htmlPages!==bytes.htmlPages||
     stableBytes.packageBytes!==bytes.packageBytes)
    throw Error('F233: private staging package changed during HTTP review');
  if(http.unauthenticatedEntryDenied!==true||
     http.coverageProfile!=='COMPLETE_PRIVATE_CATALOG_AND_LEGACY'||
     http.unauthenticatedRoutesDenied!==anonymousCount||
     http.reviewedPublicPages!==publicCount||
     http.heldLegacyPages!==legacyCount||
     http.legacyCandidatesStillHeld!==legacyUrls.filter(x=>x.status==='candidate').length||
     http.totalHttpChecks!==publicCount+legacyCount)
    throw Error('F167: private staging HTTP evidence incomplete');
  return Object.freeze({
    schema:'imagine.comercial.private-staging-operator-review.v1',
    status:'PRIVATE_CANDIDATE_REVIEWED_STILL_NO_RELEASE_AUTHORITY',
    scope:'LOOPBACK_ONLY_OPERATOR_DIAGNOSTIC',
    checks:Object.freeze({
      imageDigestSyntaxValid:true,
      exactBuildTreeBytesMatch:true,
      buildTreeBytesStableAfterHttp:true,
      publishedHtmlCount:bytes.htmlPages,
      validatedFileCount:bytes.fileCount,
      privateBcryptFileSyntaxAndPermissionsValid:true,
      unauthenticatedHomepageDenied:true,
      unauthenticatedRoutesDenied:http.unauthenticatedRoutesDenied,
      reviewedPublicPages:http.reviewedPublicPages,
      heldLegacy404Pages:http.heldLegacyPages,
      authenticatedHttpChecks:http.totalHttpChecks,
      coverageProfile:'COMPLETE_PRIVATE_CATALOG_AND_LEGACY',
      legacyCandidatesStillHeld:http.legacyCandidatesStillHeld
    }),
    imageProvenanceVerified:false,
    independentHashPinProvenanceVerified:false,
    authIdentityAndMfaVerified:false,
    externalTlsAndNetworkVerified:false,
    portalCrmOperationalVerified:false,
    independentAppSecReviewCompleted:false,
    legacy301ReleaseAuthorized:false,
    canCollectPublicLeads:false,
    deploymentAuthorized:false,
    deploymentPerformed:false
  });
}

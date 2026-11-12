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
  const http=await reviewPrivateStagingHttp({port,basicAuth,transport});
  if(http.unauthenticatedEntryDenied!==true||
     http.unauthenticatedRoutesDenied!==28||
     http.reviewedPublicPages!==4||http.heldLegacyPages!==20||
     http.totalHttpChecks!==24)
    throw Error('F167: private staging HTTP evidence incomplete');
  return Object.freeze({
    schema:'imagine.comercial.private-staging-operator-review.v1',
    status:'PRIVATE_CANDIDATE_REVIEWED_STILL_NO_RELEASE_AUTHORITY',
    scope:'LOOPBACK_ONLY_OPERATOR_DIAGNOSTIC',
    checks:Object.freeze({
      imageDigestSyntaxValid:true,
      exactBuildTreeBytesMatch:true,
      publishedHtmlCount:bytes.htmlPages,
      validatedFileCount:bytes.fileCount,
      privateBcryptFileSyntaxAndPermissionsValid:true,
      unauthenticatedHomepageDenied:true,
      unauthenticatedRoutesDenied:http.unauthenticatedRoutesDenied,
      reviewedPublicPages:http.reviewedPublicPages,
      heldLegacy404Pages:http.heldLegacyPages,
      authenticatedHttpChecks:http.totalHttpChecks
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

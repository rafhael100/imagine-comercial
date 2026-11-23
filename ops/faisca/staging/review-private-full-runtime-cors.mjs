/**
 * R257: do not accept a partial "full runtime" review that omits the
 * independent CORS/OPTIONS boundary added in R256. The operator's CLI uses
 * ONLY the real R255 and R256 modules; injection here is for synthetic tests.
 *
 * Neither report proves Docker-to-HTTP process ownership, VPS deployment,
 * authenticated conversation, external exposure or provider billing.
 */
import { reviewFaiscaPrivateFullRuntimePair } from './review-private-full-runtime-pair.mjs';
import { reviewFaiscaPrivateNoAuthPreflight } from './review-private-preflight-methods.mjs';

const HOLD = 'R257: full private runtime and CORS review unverified (HOLD)';
const fail = () => { throw Error(HOLD); };
const FULL = Object.freeze({
  schema: 'faisca.private-full-runtime-paired-evidence.v1',
  status: 'REPORTED_RUNTIME_POLICY_AND_LOOPBACK_HTTP_REVIEW_ONLY',
  reportedRuntimePolicyFieldsMatch: true,
  reportedImageAndBindingFieldsMatch: true,
  noAuthHttpProbesPassed: 19,
  noCredentialsSent: true,
  operatorEvidenceIndependentlyAuthenticated: false,
  dockerInspectionPerformed: false,
  dockerToHttpProcessOwnershipIndependentlyVerified: false,
  actualNetworkExposureIndependentlyVerified: false,
  authenticatedConversationVerified: false,
  providerSpendReconciled: false,
  publicReady: false,
  deploymentAuthorized: false,
  deploymentPerformed: false,
  publicFaiscaEnabled: false
});
const CORS = Object.freeze({
  schema: 'faisca.private-staging-noauth-cors-preflight.v1',
  status: 'LOCAL_NOAUTH_CORS_PREFLIGHT_DENIED_REVIEW_ONLY',
  blockedPreflightCount: 4,
  noCredentialsSent: true,
  corsPermissionGranted: false,
  observedOnLoopbackOnly: true,
  authenticatedConversationVerified: false,
  dockerProcessOwnershipVerified: false,
  providerSpendReconciled: false,
  publicReady: false,
  deploymentAuthorized: false,
  deploymentPerformed: false,
  publicFaiscaEnabled: false
});

/** Snapshot only own, enumerable DATA descriptors; reject extra/symbol keys. */
function exactReport(value, expected) {
  if (value === null || typeof value !== 'object' ||
      Object.getPrototypeOf(value) !== Object.prototype) return false;
  const keys = Reflect.ownKeys(value);
  const expectedKeys = Object.keys(expected);
  if (keys.length !== expectedKeys.length) return false;
  const own = Object.getOwnPropertyDescriptors(value);
  for (const key of expectedKeys) {
    const descriptor = own[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') ||
        descriptor.enumerable !== true ||
        descriptor.value !== expected[key]) return false;
  }
  return true;
}

/**
 * Fixed sequence: complete R255's 19 GET/HEAD checks first, then R256's
 * four no-credential OPTIONS requests. No partial positive report is emitted.
 * A changed upstream report shape requires renewed review, not a fallback.
 */
export async function reviewFaiscaPrivateFullRuntimeAndCors(input = {}, {
  fullReview = reviewFaiscaPrivateFullRuntimePair,
  corsReview = reviewFaiscaPrivateNoAuthPreflight
} = {}) {
  try {
    if (typeof fullReview !== 'function' || typeof corsReview !== 'function') fail();
    const runtime = await fullReview(input);
    if (!exactReport(runtime, FULL)) fail();
    const cors = await corsReview({ port: 4337 });
    if (!exactReport(cors, CORS)) fail();
    return Object.freeze({
      schema: 'faisca.private-full-runtime-cors-review.v1',
      status: 'REPORTED_RUNTIME_AND_23_LOCAL_NOAUTH_HTTP_CHECKS_REVIEW_ONLY',
      reportedDockerRuntimeMatch: true,
      noAuthGetHeadChecks: 19,
      noAuthOptionsChecks: 4,
      totalNoAuthChecks: 23,
      noCredentialsSent: true,
      corsPermissionGranted: false,
      independentlyAuthenticatedOperatorEvidence: false,
      dockerInspectionPerformed: false,
      dockerToHttpProcessOwnershipIndependentlyVerified: false,
      externalNetworkExposureIndependentlyVerified: false,
      authenticatedConversationVerified: false,
      providerSpendReconciled: false,
      publicReady: false,
      deploymentAuthorized: false,
      deploymentPerformed: false,
      publicFaiscaEnabled: false
    });
  } catch {
    throw Error(HOLD);
  }
}

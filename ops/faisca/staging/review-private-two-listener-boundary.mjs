/**
 * R259: an all-or-nothing, read-only review for BOTH private loopback
 * listeners. R257 checks reported Nginx runtime plus 23 no-auth HTTP
 * requests to :4337; R258 checks four anonymous API routes on :4336.
 * Neither proves Docker process ownership, actual VPS staging, paid API
 * results, external network exposure or authenticated conversation.
 */
import { reviewFaiscaPrivateFullRuntimeAndCors } from './review-private-full-runtime-cors.mjs';
import { reviewFaiscaPrivateApiAnonymousBoundary } from '../openai/review-private-api-noauth.mjs';

const HOLD = 'R259: two-listener private boundary unverified (HOLD)';
const NGINX = Object.freeze({
  schema: 'faisca.private-full-runtime-cors-review.v1',
  status: 'REPORTED_RUNTIME_AND_23_LOCAL_NOAUTH_HTTP_CHECKS_REVIEW_ONLY',
  reportedDockerRuntimeMatch: true, noAuthGetHeadChecks: 19,
  noAuthOptionsChecks: 4, totalNoAuthChecks: 23,
  noCredentialsSent: true, corsPermissionGranted: false,
  independentlyAuthenticatedOperatorEvidence: false,
  dockerInspectionPerformed: false,
  dockerToHttpProcessOwnershipIndependentlyVerified: false,
  externalNetworkExposureIndependentlyVerified: false,
  authenticatedConversationVerified: false,
  providerSpendReconciled: false, publicReady: false,
  deploymentAuthorized: false, deploymentPerformed: false,
  publicFaiscaEnabled: false
});
const API = Object.freeze({
  schema: 'faisca.private-api-anonymous-boundary.v1',
  status: 'PRIVATE_API_GET_OPTIONS_NOT_FOUND_REVIEW_ONLY',
  negativeRouteChecks: 4, noPostRequestsSent: true,
  noCredentialsSent: true, noOperatorTextSent: true,
  observedOnLoopbackOnly: true,
  authenticatedConversationVerified: false,
  runtimeProcessIndependentlyVerified: false,
  providerSpendReconciled: false, publicReady: false,
  deploymentAuthorized: false, deploymentPerformed: false,
  publicFaiscaEnabled: false
});

// Exact, own, enumerable DATA descriptors only. Refuse getters, extra keys,
// symbols, forged claims and throwing Proxies, without printing input.
function exactDataReport(value, expected) {
  if (value === null || typeof value !== 'object' ||
      Object.getPrototypeOf(value) !== Object.prototype) return false;
  const keys = Object.keys(expected);
  if (Reflect.ownKeys(value).length !== keys.length) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return keys.every(key => {
    const d = descriptors[key];
    return d && Object.hasOwn(d, 'value') &&
      d.enumerable === true && d.value === expected[key];
  });
}

/** Injection is exclusively for synthetic tests. CLI uses real modules. */
export async function reviewFaiscaPrivateTwoListenerBoundary(input = {}, {
  nginxReview = reviewFaiscaPrivateFullRuntimeAndCors,
  apiReview = reviewFaiscaPrivateApiAnonymousBoundary
} = {}) {
  try {
    if (typeof nginxReview !== 'function' || typeof apiReview !== 'function') {
      throw Error(HOLD);
    }
    const nginx = await nginxReview(input);
    if (!exactDataReport(nginx, NGINX)) throw Error(HOLD);
    const api = await apiReview({ port: 4336 });
    if (!exactDataReport(api, API)) throw Error(HOLD);
    return Object.freeze({
      schema: 'faisca.private-two-listener-boundary.v1',
      status: 'REPORTED_NGINX_AND_27_LOCAL_NEGATIVE_HTTP_CHECKS_REVIEW_ONLY',
      staticListenerLoopbackPort: 4337,
      apiListenerLoopbackPort: 4336,
      staticNoAuthChecks: 23, apiNoAuthChecks: 4,
      totalNoAuthChecks: 27, noCredentialsSent: true,
      noPromptsOrPostSent: true,
      operatorEvidenceIndependentlyAuthenticated: false,
      dockerInspectionPerformed: false,
      dockerToHttpProcessOwnershipIndependentlyVerified: false,
      apiToStaticListenerProcessOwnershipVerified: false,
      externalNetworkExposureIndependentlyVerified: false,
      authenticatedConversationVerified: false,
      providerSpendReconciled: false, publicReady: false,
      deploymentAuthorized: false, deploymentPerformed: false,
      publicFaiscaEnabled: false
    });
  } catch {
    throw Error(HOLD);
  }
}

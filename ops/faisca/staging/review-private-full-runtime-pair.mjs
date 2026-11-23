/**
 * R255: make R253 paired Docker/HTTP evidence fail closed unless the full
 * R236-R238 reported runtime policy passes first. Operator JSON is untrusted.
 */
import { resolve } from 'node:path';
import { reviewRunningFaiscaPrivateContainer } from './review-running-container.mjs';
import { reviewFaiscaPrivatePairedEvidence } from './review-private-paired-evidence.mjs';

const HOLD = 'R255: full private runtime and HTTP review unverified (HOLD)';
const insist = ok => { if (!ok) throw Error(HOLD); };
const STATUS = 'REPORTED_DOCKER_BINDING_AND_LOCAL_NOAUTH_HTTP_REVIEW_ONLY';

/**
 * Does NOT inspect Docker, verify actual process/port ownership, or call an
 * authenticated API. Optional transport injection is for synthetic tests;
 * the operator CLI always uses R253's real localhost-only 19 probes.
 */
export async function reviewFaiscaPrivateFullRuntimePair({
  container, image, expectedImage, expectedWorkingDir,
  expectedSitePath, expectedAuthPath
} = {}, { pairedReview = reviewFaiscaPrivatePairedEvidence } = {}) {
  try {
    insist(typeof expectedWorkingDir === 'string' &&
      typeof pairedReview === 'function');
    const expectedConfigPath = resolve(
      expectedWorkingDir, 'ops/faisca/staging/nginx.conf');
    const expectedComposePath = resolve(
      expectedWorkingDir, 'ops/faisca/staging/compose.yaml');
    const runtime = reviewRunningFaiscaPrivateContainer({
      inspect: container, expectedImage, expectedWorkingDir,
      expectedSitePath, expectedConfigPath, expectedAuthPath,
      expectedComposePath
    });
    insist(runtime.status === 'DOCKER_INSPECT_FIELDS_MATCH_REVIEW_ONLY' &&
      runtime.inspectedOneRunningContainerRecord === true &&
      runtime.reportedLoopbackBinding === true &&
      runtime.reportedUnprivilegedReadOnlyMounts === true &&
      runtime.reportedBoundedNoexecTmpfs === true &&
      runtime.reportedNoExplicitHostNamespaceOrDevices === true &&
      runtime.reportedResourceLimits === true &&
      runtime.dockerAccessPerformedByThisModule === false &&
      runtime.actualNetworkExposureIndependentlyVerified === false &&
      runtime.authenticatedHttpVerified === false &&
      runtime.publicFaiscaEnabled === false);
    // No host or port from input: R253 always targets 127.0.0.1:4337.
    const paired = await pairedReview({
      container, image, expectedImage, port: 4337
    });
    insist(paired && paired.status === STATUS &&
      paired.noAuthHttpProbesPassed === 19 &&
      paired.reportedImageIdentityMatchesIndependentPin === true &&
      paired.reportedDockerPortMatchesProbedLoopbackPort === true &&
      paired.reviewedDefaultStagingPort === true &&
      paired.noCredentialsSent === true &&
      paired.dockerInspectionPerformed === false &&
      paired.dockerToHttpProcessOwnershipIndependentlyVerified === false &&
      paired.authenticatedConversationVerified === false &&
      paired.providerSpendReconciled === false &&
      paired.publicReady === false &&
      paired.deploymentAuthorized === false &&
      paired.publicFaiscaEnabled === false);
    return Object.freeze({
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
  } catch {
    throw Error(HOLD);
  }
}

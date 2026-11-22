/**
 * R253: pair two independent review observations, never an operational attestation.
 * Docker records are operator-supplied and untrusted. Actual HTTP requests go
 * only to 127.0.0.1. Matching reported ports DOES NOT prove Docker served them.
 */
import { reviewFaiscaPrivateLocalImageIdentity } from './review-image-identity.mjs';
import {
  reviewFaiscaPrivateNoAuthLoopback,
  reviewFaiscaPrivateNoAuthAliases,
  reviewFaiscaPrivateNoAuthCanonicalization
} from './review-private-http-boundary.mjs';

const HOLD = 'R253: paired private staging evidence unverified (HOLD)';
const insist = ok => { if (!ok) throw Error(HOLD); };
const plain = o => o !== null && typeof o === 'object' &&
  !Array.isArray(o) && Object.getPrototypeOf(o) === Object.prototype;
const own = (o,k) => plain(o) && Object.hasOwn(o,k);
function binding(x, port) {
  return plain(x) && Object.keys(x).length === 2 &&
    x.HostIp === '127.0.0.1' && x.HostPort === String(port);
}
function inspectClaim(container, port, expectedImage) {
  insist(plain(container) && plain(container.State) &&
    container.State.Running === true && container.State.Status === 'running');
  const config = container.Config, host = container.HostConfig;
  const net = container.NetworkSettings;
  insist(plain(config) && plain(config.Labels) && plain(host) && plain(net));
  const labels = config.Labels;
  const project = labels['com.docker.compose.project'];
  insist(typeof project === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(project) &&
    labels['com.docker.compose.service'] === 'faisca-review' &&
    labels['com.docker.compose.oneoff'] === 'False' &&
    config.Image === expectedImage && config.User === '101:101');
  insist(host.Privileged === false && host.PublishAllPorts === false &&
    host.NetworkMode === project + '_default');
  insist(plain(host.PortBindings) && Object.keys(host.PortBindings).length === 1 &&
    Array.isArray(host.PortBindings['8080/tcp']) &&
    host.PortBindings['8080/tcp'].length === 1 &&
    binding(host.PortBindings['8080/tcp'][0],port));
  insist(plain(net.Ports) && Array.isArray(net.Ports['8080/tcp']) &&
    net.Ports['8080/tcp'].length === 1 &&
    binding(net.Ports['8080/tcp'][0],port) &&
    Object.entries(net.Ports).every(([key,value]) =>
      key === '8080/tcp' || value === null));
  insist(plain(net.Networks) &&
    Object.keys(net.Networks).length === 1 &&
    own(net.Networks, project + '_default'));
}
/**
 * Error responses intentionally discard all untrusted details. No container
 * IDs, paths, HTTP response bodies, secrets or image pins are returned.
 */
export async function reviewFaiscaPrivatePairedEvidence({
  container, image, expectedImage, port=4337
}={}) {
  insist(Number.isInteger(port) && port > 0 && port <= 65535);
  try {
    const identity = reviewFaiscaPrivateLocalImageIdentity({
      container, image, expectedImage
    });
    insist(identity.reportedImageConfigIdMatchesDaemonMetadata === true &&
      identity.reportedManifestReferenceMatchesPin === true);
    inspectClaim(container, port, expectedImage);
    const canonical = await reviewFaiscaPrivateNoAuthLoopback({port});
    const aliases = await reviewFaiscaPrivateNoAuthAliases({port});
    const noncanonical = await reviewFaiscaPrivateNoAuthCanonicalization({port});
    const parts = [canonical,aliases,noncanonical];
    insist(parts.every(x =>
      x.observedOnLoopbackOnly === true && x.noCredentialsSent === true &&
      x.authenticatedExperienceVerified === false &&
      x.deploymentAuthorized === false && x.publicFaiscaEnabled === false));
    const count = parts.reduce((n,x) => n + x.protectedProbeCount,0);
    insist(count === 19);
    return Object.freeze({
      schema:'faisca.private-staging-paired-local-evidence.v1',
      status:'REPORTED_DOCKER_BINDING_AND_LOCAL_NOAUTH_HTTP_REVIEW_ONLY',
      reportedImageIdentityMatchesIndependentPin:true,
      reportedDockerPortMatchesProbedLoopbackPort:true,
      reviewedDefaultStagingPort:port === 4337,
      noAuthHttpProbesPassed:count,
      noCredentialsSent:true,
      dockerInspectionPerformed:false,
      dockerToHttpProcessOwnershipIndependentlyVerified:false,
      containerRuntimePolicyFullyVerified:false,
      registryProvenanceIndependentlyVerified:false,
      independentNetworkExposureVerified:false,
      authenticatedConversationVerified:false,
      providerSpendReconciled:false,
      operatorEvidenceAuthenticated:false,
      publicReady:false,
      deploymentAuthorized:false,
      deploymentPerformed:false,
      publicFaiscaEnabled:false
    });
  } catch {
    throw Error(HOLD);
  }
}

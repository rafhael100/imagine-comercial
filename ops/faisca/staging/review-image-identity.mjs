/**
 * R239 — read-only correlation of a running Docker container's local image ID
 * with the daemon's image metadata. The manifest digest in RepoDigests and
 * the image config digest in Id are DIFFERENT OCI objects; never compare them.
 *
 * All inputs are untrusted, synthetic or operator-supplied JSON; this module
 * does not access Docker, registries, credentials, HTTP, SSH or the VPS.
 */
import { reviewPrivateStagingImage } from '../../../src/lib/private-staging-image-policy.mjs';

const HOLD = 'R239: private Faísca image identity unverified (HOLD)';
const insist = value => { if (!value) throw Error(HOLD); };
const plain = value => value !== null && typeof value === 'object' &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const localId = value => typeof value === 'string' &&
  /^sha256:[0-9a-f]{64}$/.test(value) &&
  new Set(value.slice(7)).size > 1;
function field(obj, name) {
  insist(plain(obj));
  const descriptor = Object.getOwnPropertyDescriptor(obj, name);
  insist(descriptor && Object.hasOwn(descriptor, 'value'));
  return descriptor.value;
}

/**
 * The expected manifest reference MUST come from an independent operator pin,
 * never from the inspected container, local RepoDigests, or the same bundle.
 */
export function reviewFaiscaPrivateLocalImageIdentity({
  container, image, expectedImage
} = {}) {
  reviewPrivateStagingImage(expectedImage);
  const config = field(container, 'Config');
  insist(field(config, 'Image') === expectedImage);
  const runtimeConfigId = field(container, 'Image');
  insist(localId(runtimeConfigId));
  const daemonConfigId = field(image, 'Id');
  insist(localId(daemonConfigId) && runtimeConfigId === daemonConfigId);
  const digests = field(image, 'RepoDigests');
  // Exact single immutable reference: no unreviewed aliases or mutable tag
  // can be accepted in place of the independently pinned manifest reference.
  insist(Array.isArray(digests) && digests.length === 1 &&
    digests[0] === expectedImage);
  insist(field(image, 'Os') === 'linux');
  insist(['amd64', 'arm64'].includes(field(image, 'Architecture')));
  return Object.freeze({
    schema: 'faisca.private-staging-local-image-identity-review.v1',
    status: 'LOCAL_DOCKER_IMAGE_IDS_CORRELATED_REVIEW_ONLY',
    reportedRuntimeImageReferenceMatchesPin: true,
    reportedImageConfigIdMatchesDaemonMetadata: true,
    reportedManifestReferenceMatchesPin: true,
    configDigestDistinctFromManifestDigest: true,
    dockerAccessPerformedByThisModule: false,
    registryManifestIndependentlyFetched: false,
    signatureAndSupplyChainProvenanceVerified: false,
    localEvidenceAuthenticated: false,
    deploymentAuthorized: false,
    deploymentPerformed: false,
    publicFaiscaEnabled: false
  });
}

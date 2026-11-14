/**
 * F164 — image-reference syntax gate for manually managed private staging.
 * Does NOT verify the image's signature, provenance, CVEs or deployed bytes;
 * independent operator review is required before any Docker command.
 */
const expected=/^nginxinc\/nginx-unprivileged@sha256:([0-9a-f]{64})$/;

export function reviewPrivateStagingImage(image){
  if(typeof image!=='string'||image.length>160||
    !expected.test(image)||
    /[\r\n\0]/.test(image))
    throw Error('F164: staging image must be the reviewed Nginx unprivileged image pinned by SHA-256');
  const hash=expected.exec(image)[1];
  if(new Set(hash).size===1)
    throw Error('F164: placeholder digest cannot be used for private staging');
  return Object.freeze({
    schema:'imagine.comercial.private-staging-image-syntax.v1',
    immutableDigestSyntax:true,
    imageProvenanceIndependentlyVerified:false,
    imageSignatureIndependentlyVerified:false,
    deploymentAuthorized:false,
    deploymentPerformed:false,
    nextRequiredAction:'MANUAL_IMAGE_PROVENANCE_AND_DIGEST_VERIFICATION'
  });
}

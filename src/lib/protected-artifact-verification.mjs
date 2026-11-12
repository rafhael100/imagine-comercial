/**
 * F38 — segunda conferência offline de um pacote Astro assinado.
 *
 * O relatório REVIEW-ONLY é material não confiável e não serve como pin.
 * O SHA-256 esperado deve vir de canal independente do artefato analisado.
 * Não emite autorização de publicação, recibo remoto ou assinatura.
 */
import assert from 'node:assert/strict';
import {timingSafeEqual} from 'node:crypto';
import {assertBuildReleaseIntent} from './build-release-target.mjs';
import {createSignedBuildReview} from './signed-build-review.mjs';

const SHA=/^[0-9a-f]{64}$/;
const schema='imagine.comercial.protected-build-review.v1';
const reviewMode='OFFLINE_SIGNED_BUILD_REVIEW_NOT_AUTHORIZED_FOR_DEPLOY';
const allowedFields=new Set([
  'schema','mode','target','releaseId','keyId',
  'catalogPayloadSha256','compiledTreeSha256','outputFiles',
  'verifiedServiceCount','deploymentPerformed'
]);
function requireDigest(value,label){
  if(typeof value!=='string'||!SHA.test(value))
    throw new Error('protected artifact: missing trusted '+label+' SHA-256');
  return value;
}
function exactHash(received,expected,label){
  const left=Buffer.from(requireDigest(received,label),'hex');
  const right=Buffer.from(requireDigest(expected,label),'hex');
  if(!timingSafeEqual(left,right))
    throw new Error('protected artifact: '+label+' digest does not match trusted pin');
}
function record(value){
  if(value===null||typeof value!=='object'||Array.isArray(value)||
     Object.getPrototypeOf(value)!==Object.prototype)return false;
  // F219: a report, envelope or independent pin object must contain only
  // ordinary enumerable JSON data. No getters, symbols or hidden fields.
  return Reflect.ownKeys(value).every(key=>{
    if(typeof key!=='string')return false;
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    return descriptor?.enumerable===true&&Object.hasOwn(descriptor,'value');
  });
}

export function verifyProtectedArtifact({
  files,review,envelope,trustKeys,expectedKeyId,
  pins,expectedTarget,expectedTreeSha256
}={}) {
  // Expected target MUST be a separately provided trusted input.
  const intent=assertBuildReleaseIntent({
    IMAGINE_RELEASE_TARGET:expectedTarget,
    IMAGINE_CATALOG_REQUIRE_SIGNED:'1'
  });
  if(intent.target==='review')throw new Error('protected artifact: review target not verifiable');
  requireDigest(expectedTreeSha256,'tree');
  const isPlain=record(review);
  const fields=isPlain?Reflect.ownKeys(review):[];
  if(!isPlain || fields.length!==allowedFields.size ||
     !fields.every(k=>allowedFields.has(k))) {
    // Report diagnostic counts only, never echo fields or untrusted values.
    throw new Error('protected artifact: exact REVIEW-ONLY schema required (plain='+
      isPlain+', fields='+fields.length+', expected='+allowedFields.size+')');
  }
  if(review.schema!==schema || review.mode!==reviewMode ||
     review.target!==intent.target || review.deploymentPerformed!==false)
    throw new Error('protected artifact: target or review mode mismatched');
  if(typeof expectedKeyId!=='string' || !(trustKeys instanceof Map) ||
     !trustKeys.has(expectedKeyId) || !record(envelope) ||
     envelope.keyId!==expectedKeyId || review.keyId!==expectedKeyId)
    throw new Error('protected artifact: key identity is not independently trusted');
  if(!record(pins)||Reflect.ownKeys(pins).length!==2||
      !Object.hasOwn(pins,'expectedReleaseId')||
      !Object.hasOwn(pins,'expectedPayloadSha256'))
    throw new Error('protected artifact: independent release pins required');
  exactHash(review.compiledTreeSha256,expectedTreeSha256,'tree');
  exactHash(review.catalogPayloadSha256,pins.expectedPayloadSha256,'catalog');
  if(typeof pins.expectedReleaseId!=='string'||review.releaseId!==pins.expectedReleaseId)
    throw new Error('protected artifact: release ID does not match trusted pin');

  // Re-read and recompute the complete tree, canonical/meta and signed fields.
  const actual=createSignedBuildReview(files,envelope,trustKeys,pins);
  exactHash(actual.treeSha256,expectedTreeSha256,'tree');
  exactHash(actual.payloadSha256,pins.expectedPayloadSha256,'catalog');
  assert.equal(review.compiledTreeSha256,actual.treeSha256,
    'protected artifact: copied review tree differs from output bytes');
  assert.equal(review.releaseId,actual.releaseId,
    'protected artifact: copied review release differs from signed catalog');
  assert.equal(review.keyId,actual.keyId,'protected artifact: copied review key differs');
  assert.equal(review.outputFiles,actual.fileCount,
    'protected artifact: file count differs');
  assert.equal(review.verifiedServiceCount,actual.verifiedServiceCount,
    'protected artifact: signed service count differs');

  return Object.freeze({
    schema:'imagine.comercial.protected-artifact-verification.v1',
    mode:'OFFLINE_VERIFY_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
    target:intent.target,releaseId:actual.releaseId,
    treeSha256:actual.treeSha256,
    verifiedServiceCount:actual.verifiedServiceCount,
    deploymentPerformed:false
  });
}

/**
 * F47 — composed offline evidence checks against one independently pinned
 * release, using the real F38 package verifier and F45 witness verifier.
 *
 * The trusted orchestrator supplies the pins, trust roots and monotonic
 * policy sequence. This has NO publishing or network effects. Receipts are
 * verified and reserved only after the package itself has passed F38.
 */
import {verifyProtectedArtifact} from './protected-artifact-verification.mjs';
import {verifyReceiptWithSignedWitnessPolicy} from './signed-witness-trust-policy.mjs';
import {compareReleaseEvidence} from './release-evidence-review.mjs';

const HEX=/^[0-9a-f]{64}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
function exact(value,fields){
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  Object.getPrototypeOf(value)===Object.prototype&&
  Object.keys(value).length===fields.length&&
  Object.keys(value).every(field=>fields.includes(field));
}
export async function verifyProtectedReleaseWithWitness({
 files,review,envelope,catalogTrustKeys,expectedCatalogKeyId,
 catalogPins,expectedRelease,receipt,witnessPolicyEnvelope,
 rootKeys,expectedRootKeyId,minPolicySequence,publisherKeyId,
 nowSeconds,ledger,historyText,expectedHistorySha256
}={}){
 if(!exact(expectedRelease,['releaseId','target','treeSha256','witnessKeyId'])||
  typeof expectedRelease.releaseId!=='string'||!ID.test(expectedRelease.releaseId)||
  !['staging','production'].includes(expectedRelease.target)||
  typeof expectedRelease.treeSha256!=='string'||!HEX.test(expectedRelease.treeSha256)||
  typeof expectedRelease.witnessKeyId!=='string'||!ID.test(expectedRelease.witnessKeyId))
  throw new Error('protected release: independent complete pins required');
 if(!exact(catalogPins,['expectedReleaseId','expectedPayloadSha256'])||
  catalogPins.expectedReleaseId!==expectedRelease.releaseId)
  throw new Error('protected release: catalog and release pins diverge');
 // Do not reserve a witness nonce until the artifact is independently valid.
 const artifactVerification=verifyProtectedArtifact({
  files,review,envelope,trustKeys:catalogTrustKeys,
  expectedKeyId:expectedCatalogKeyId,
  pins:catalogPins,
  expectedTarget:expectedRelease.target,
  expectedTreeSha256:expectedRelease.treeSha256,
  historyText,expectedHistorySha256
 });
 const witness=await verifyReceiptWithSignedWitnessPolicy({
  receipt,expected:expectedRelease,envelope:witnessPolicyEnvelope,
  rootKeys,expectedRootKeyId,minSequence:minPolicySequence,
  publisherKeyId,nowSeconds,ledger
 });
 // Only internally convert a freshly verified F45 result into the limited
 // F39 review shape expected by F40. Never accept this from an API/JSON input.
 const deliveryReceipt={
  status:'SIGNED_RECEIPT_LAB_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
  releaseId:witness.releaseId,target:witness.target,
  treeSha256:witness.treeSha256,witnessKeyId:witness.witnessKeyId,
  verified:witness.replayReserved===true,deploymentAuthorized:false
 };
 const correlated=compareReleaseEvidence({
  artifactVerification,deliveryReceipt,expected:{
   releaseId:expectedRelease.releaseId,target:expectedRelease.target,
   treeSha256:expectedRelease.treeSha256
  }
 });
 return Object.freeze({
  schema:'imagine.comercial.protected-release-witness-review.v1',
  status:'END_TO_END_OFFLINE_LAB_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
  releaseId:correlated.releaseId,target:correlated.target,
  treeSha256:correlated.treeSha256,
  verifiedServiceCount:correlated.verifiedServiceCount,
  witnessKeyId:correlated.witnessKeyId,
  policySequence:witness.policySequence,replayReserved:true,
  deploymentPerformed:false,deploymentAuthorized:false
 });
}

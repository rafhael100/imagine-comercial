/**
 * F40 — bind two independently checked LAB observations to the same release.
 * Does not verify signatures itself, issue deployment authority or claim
 * a remote destination exists. Callers must supply results from F38/F39.
 */
const HEX=/^[0-9a-f]{64}$/;
const NAME=/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const PKG_FIELDS=['schema','mode','target','releaseId','treeSha256','verifiedServiceCount','deploymentPerformed'];
const RECEIPT_FIELDS=['status','releaseId','target','treeSha256','witnessKeyId','verified','deploymentAuthorized'];
function exactRecord(o,fields){
  return o!==null&&typeof o==='object'&&!Array.isArray(o)&&
    Object.getPrototypeOf(o)===Object.prototype &&
    Object.keys(o).length===fields.length &&
    Object.keys(o).every(k=>fields.includes(k));
}
export function compareReleaseEvidence({artifactVerification,deliveryReceipt,expected}={}){
  if(!exactRecord(artifactVerification,PKG_FIELDS) ||
    artifactVerification.schema!=='imagine.comercial.protected-artifact-verification.v1' ||
    artifactVerification.mode!=='OFFLINE_VERIFY_ONLY_NOT_AUTHORIZED_FOR_DEPLOY' ||
    artifactVerification.deploymentPerformed!==false ||
    !Number.isSafeInteger(artifactVerification.verifiedServiceCount)||
    artifactVerification.verifiedServiceCount<=0)
    throw new Error('release evidence: valid F38 offline verification required');
  if(!exactRecord(deliveryReceipt,RECEIPT_FIELDS) ||
    deliveryReceipt.status!=='SIGNED_RECEIPT_LAB_ONLY_NOT_AUTHORIZED_FOR_DEPLOY' ||
    deliveryReceipt.verified!==true || deliveryReceipt.deploymentAuthorized!==false ||
    typeof deliveryReceipt.witnessKeyId!=='string'||!NAME.test(deliveryReceipt.witnessKeyId))
    throw new Error('release evidence: valid F39 laboratory receipt required');
  const isPlain=expected!==null&&typeof expected==='object'&&!Array.isArray(expected)&&
    Object.getPrototypeOf(expected)===Object.prototype;
  if(!isPlain || Object.keys(expected).length!==3 ||
    !['releaseId','target','treeSha256'].every(k=>Object.hasOwn(expected,k)) ||
    typeof expected.releaseId!=='string'||!NAME.test(expected.releaseId) ||
    !['staging','production'].includes(expected.target) ||
    typeof expected.treeSha256!=='string'||!HEX.test(expected.treeSha256))
    throw new Error('release evidence: independent release pins required');
  for(const field of ['releaseId','target','treeSha256']){
    if(artifactVerification[field]!==expected[field] ||
       deliveryReceipt[field]!==expected[field])
      throw new Error('release evidence: '+field+' mismatch between independent inputs');
  }
  return Object.freeze({
    schema:'imagine.comercial.release-evidence-review.v1',
    status:'CORRELATED_LAB_EVIDENCE_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
    releaseId:expected.releaseId,target:expected.target,treeSha256:expected.treeSha256,
    witnessKeyId:deliveryReceipt.witnessKeyId,
    verifiedServiceCount:artifactVerification.verifiedServiceCount,
    deploymentPerformed:false,deploymentAuthorized:false
  });
}

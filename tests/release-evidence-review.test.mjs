import test from 'node:test';
import assert from 'node:assert/strict';
import {compareReleaseEvidence} from '../src/lib/release-evidence-review.mjs';
const tree='a'.repeat(64);
function fixture(){
 const expected={releaseId:'release_test_01',target:'staging',treeSha256:tree};
 const artifactVerification={schema:'imagine.comercial.protected-artifact-verification.v1',
   mode:'OFFLINE_VERIFY_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',...expected,
   verifiedServiceCount:6,deploymentPerformed:false};
 const deliveryReceipt={status:'SIGNED_RECEIPT_LAB_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
   ...expected,witnessKeyId:'witness_lab_01',verified:true,deploymentAuthorized:false};
 return {expected,artifactVerification,deliveryReceipt};
}
test('F40 correlates independently supplied lab observations, never authorizes deploy',()=>{
 const result=compareReleaseEvidence(fixture());
 assert.equal(result.deploymentAuthorized,false);
 assert.equal(result.deploymentPerformed,false);
 assert.match(result.status,/LAB_EVIDENCE_ONLY/);
 assert.equal(result.verifiedServiceCount,6);
 assert.equal(Object.isFrozen(result),true);
});
test('F40 rejects every release dimension mismatch in package',()=>{
 for(const [field,value] of [['releaseId','release_other_01'],['target','production'],['treeSha256','b'.repeat(64)]]){
  const f=fixture();f.artifactVerification[field]=value;
  assert.throws(()=>compareReleaseEvidence(f),new RegExp(field+' mismatch'));
 }
});
test('F40 rejects every release dimension mismatch in receipt',()=>{
 for(const [field,value] of [['releaseId','release_other_01'],['target','production'],['treeSha256','b'.repeat(64)]]){
  const f=fixture();f.deliveryReceipt[field]=value;
  assert.throws(()=>compareReleaseEvidence(f),new RegExp(field+' mismatch'));
 }
});
test('F40 rejects untrusted expectations and extra fields',()=>{
 const f=fixture();
 assert.throws(()=>compareReleaseEvidence({...f,expected:{...f.expected,treeSha256:'x'.repeat(64)}}),/pins/);
 assert.throws(()=>compareReleaseEvidence({...f,expected:{...f.expected,nonce:'something'}}),/pins/);
 assert.throws(()=>compareReleaseEvidence({...f,artifactVerification:{...f.artifactVerification,deploymentPerformed:true}}),/F38/);
 assert.throws(()=>compareReleaseEvidence({...f,deliveryReceipt:{...f.deliveryReceipt,deploymentAuthorized:true}}),/F39/);
 assert.throws(()=>compareReleaseEvidence({...f,deliveryReceipt:{...f.deliveryReceipt,unknown:true}}),/F39/);
});
test('F40 refuses simulated evidence presented as operational authorization',()=>{
 const f=fixture();
 for(const mode of ['AUTHORIZED_FOR_DEPLOY','DEPLOYMENT_COMPLETE']){
  assert.throws(()=>compareReleaseEvidence({...f,artifactVerification:{...f.artifactVerification,mode}}),/F38/);
 }
 assert.throws(()=>compareReleaseEvidence({...f,deliveryReceipt:{...f.deliveryReceipt,verified:false}}),/F39/);
});

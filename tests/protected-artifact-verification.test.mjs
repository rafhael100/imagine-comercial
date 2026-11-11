import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyProtectedArtifact} from '../src/lib/protected-artifact-verification.mjs';

const digest='a'.repeat(64);
const mock=()=>({
  files:[],
  review:{
    schema:'imagine.comercial.protected-build-review.v1',
    mode:'OFFLINE_SIGNED_BUILD_REVIEW_NOT_AUTHORIZED_FOR_DEPLOY',
    target:'staging',
    releaseId:'release_test_01',
    keyId:'portal_test_01',
    catalogPayloadSha256:digest,
    compiledTreeSha256:digest,
    outputFiles:16,
    verifiedServiceCount:1,
    deploymentPerformed:false
  },
  envelope:{keyId:'portal_test_01'},
  trustKeys:new Map([['portal_test_01','synthetic-key-marker']]),
  expectedKeyId:'portal_test_01',
  pins:{expectedReleaseId:'release_test_01',expectedPayloadSha256:digest},
  expectedTarget:'staging',
  expectedTreeSha256:digest
});
test('F38 refuses review target, missing target and unexpected target',()=>{
  for(const target of [undefined,'review','prod','production ','STAGING']){
    assert.throws(()=>verifyProtectedArtifact({...mock(),expectedTarget:target}),
      /review target not verifiable|invalid release target/);
  }
});
test('F38 requires a trusted independent SHA-256 tree pin',()=>{
  for(const value of [undefined,'',null,'a'.repeat(63),'0'.repeat(65),'x'.repeat(64)]){
    assert.throws(()=>verifyProtectedArtifact({...mock(),expectedTreeSha256:value}),
      /missing trusted tree SHA-256/);
  }
  assert.throws(()=>verifyProtectedArtifact({...mock(),
    expectedTreeSha256:'b'.repeat(64)
  }),/tree digest does not match trusted pin/);
});
test('F38 rejects review fields that claim deploy, an unknown schema or extra keys',()=>{
  for(const changes of [
    {deploymentPerformed:true},
    {mode:'AUTHORIZED_FOR_DEPLOY'},
    {target:'production'},
    {schema:'other-schema'},
    {unexpectedFlag:true}
  ]) {
    const source=mock();
    assert.throws(()=>verifyProtectedArtifact({
      ...source,review:{...source.review,...changes}
    }),/exact REVIEW-ONLY schema|required|mismatched/);
  }
});
test('F38 rejects copied report identity, key mismatch, and untrusted release pins',()=>{
  assert.throws(()=>verifyProtectedArtifact({
    ...mock(),expectedKeyId:'portal_other_01'
  }),/key identity/);
  assert.throws(()=>verifyProtectedArtifact({
    ...mock(),pins:{expectedReleaseId:'release_other_01',expectedPayloadSha256:digest}
  }),/release ID does not match trusted pin/);
  assert.throws(()=>verifyProtectedArtifact({
    ...mock(),pins:{expectedReleaseId:'release_test_01',
      expectedPayloadSha256:'b'.repeat(64)}
  }),/catalog digest does not match trusted pin/);
});
test('F38 rejects a mutable/forged report object before inspecting output files',()=>{
  const data=mock();
  const report=Object.assign(Object.create(null),data.review);
  assert.throws(()=>verifyProtectedArtifact({...data,review:report}),
    /exact REVIEW-ONLY schema required/);
  assert.throws(()=>verifyProtectedArtifact({...data,review:[]}),
    /exact REVIEW-ONLY schema required/);
});

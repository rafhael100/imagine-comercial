import test from 'node:test';
import assert from 'node:assert/strict';
import {RELEASE_GATES,evaluateLaunchReadiness} from '../src/lib/launch-readiness.mjs';
const evidence='https://github.com/rafhael100/imagine-comercial/pull/44';
test('F42 defaults to fail-closed inventory for production',()=>{
 const result=evaluateLaunchReadiness();
 assert.equal(result.unresolved.length,RELEASE_GATES.length);
 assert.equal(result.reviewedCount,0);
 assert.equal(result.deploymentAuthorized,false);
 assert.equal(result.state,'BLOCKED_REVIEW_ONLY');
 assert.ok(Object.isFrozen(result.gates));
});
test('F42 never grants deployment even if every gate is declared reviewed',()=>{
 const gates=RELEASE_GATES.map(id=>({id,status:'reviewed',evidenceUrls:[evidence]}));
 const result=evaluateLaunchReadiness({gates});
 assert.deepEqual(result.unresolved,[]);
 assert.equal(result.state,'ALL_DECLARED_REVIEWED_NOT_AUTHORIZED');
 assert.equal(result.deploymentAuthorized,false);
 assert.equal(result.deploymentPerformed,false);
});
test('F42 does not treat unverified status or missing gate as approved',()=>{
 const result=evaluateLaunchReadiness({requestedTarget:'staging',gates:[
  {id:'staging-private-vps',status:'reviewed',evidenceUrls:[evidence]},
  {id:'portal-authn-mfa-grants',status:'blocked',evidenceUrls:[]}
 ]});
 assert.equal(result.reviewedCount,1);
 assert.ok(result.unresolved.includes('portal-authn-mfa-grants'));
 assert.ok(result.unresolved.includes('release-owner-explicit-approval'));
 assert.equal(result.deploymentAuthorized,false);
});
test('F42 rejects duplicate, unknown or forged gate metadata',()=>{
 const good={id:RELEASE_GATES[0],status:'reviewed',evidenceUrls:[evidence]};
 for(const gates of [[good,good],[{...good,id:'secret-auto-publish'}],
  [{...good,status:'approved'}],[{...good,evidenceUrls:[]}],
  [{...good,evidenceUrls:['http://example.invalid']}],
  [{...good,extra:true}],[{...good,evidenceUrls:[evidence,evidence]}]]){
   assert.throws(()=>evaluateLaunchReadiness({gates}),/invalid|duplicate/);
 }
 assert.throws(()=>evaluateLaunchReadiness({requestedTarget:'live'}),/invalid target/);
});

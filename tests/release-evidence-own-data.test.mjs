import test from 'node:test';
import assert from 'node:assert/strict';
import {compareReleaseEvidence} from '../src/lib/release-evidence-review.mjs';

const hash='a'.repeat(64);
function fixture(){
  const expected={releaseId:'release_test_01',target:'staging',treeSha256:hash};
  return {
    artifactVerification:{
      schema:'imagine.comercial.protected-artifact-verification.v1',
      mode:'OFFLINE_VERIFY_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
      ...expected,verifiedServiceCount:6,deploymentPerformed:false
    },
    deliveryReceipt:{
      status:'SIGNED_RECEIPT_LAB_ONLY_NOT_AUTHORIZED_FOR_DEPLOY',
      ...expected,witnessKeyId:'witness_lab_01',verified:true,
      deploymentAuthorized:false
    },
    expected
  };
}

test('F294 valid ordinary release evidence still compares without authority',()=>{
  const data=fixture();
  Object.freeze(data.artifactVerification);
  Object.freeze(data.deliveryReceipt);
  Object.freeze(data.expected);
  const report=compareReleaseEvidence(Object.freeze(data));
  assert.equal(report.verifiedServiceCount,6);
  assert.equal(report.deploymentAuthorized,false);
  assert.equal(report.deploymentPerformed,false);
});

test('F294 never invoke any credential- or approval-like getter',()=>{
  let called=0;
  for(const key of ['artifactVerification','deliveryReceipt','expected']){
    const data=fixture();
    Object.defineProperty(data,key,{
      enumerable:true,
      get(){called++;throw Error('PRIVATE_F294_SECRET_GETTER');}
    });
    assert.throws(()=>compareReleaseEvidence(data),
      /invalid review input container/);
  }
  for(const collection of ['artifactVerification','deliveryReceipt','expected']){
    const data=fixture();
    const key=Object.keys(data[collection])[0];
    Object.defineProperty(data[collection],key,{
      enumerable:true,
      get(){called++;throw Error('PRIVATE_F294_SECRET_GETTER');}
    });
    assert.throws(()=>compareReleaseEvidence(data),/release evidence:/);
  }
  assert.equal(called,0);
});

test('F294 hidden and symbol approvals cannot masquerade as JSON evidence',()=>{
  for(const category of ['artifactVerification','deliveryReceipt','expected']){
    const hidden=fixture();
    Object.defineProperty(hidden[category],'productionApproved',{
      value:true,enumerable:false
    });
    assert.throws(()=>compareReleaseEvidence(hidden),/release evidence:/);

    const symbol=fixture();
    symbol[category][Symbol('approved')]=true;
    assert.throws(()=>compareReleaseEvidence(symbol),/release evidence:/);

    const inherited=fixture();
    Object.setPrototypeOf(inherited[category],{approved:true});
    assert.throws(()=>compareReleaseEvidence(inherited),/release evidence:/);
  }
  const input=fixture();
  Object.defineProperty(input,'secretApproval',{value:true,enumerable:false});
  assert.throws(()=>compareReleaseEvidence(input),/invalid review input container/);
});

test('F294 disallow extra or incomplete root and never echo private fields',()=>{
  for(const changed of [
    {...fixture(),secret:'PRIVATE_F294_LEAK'},
    Object.assign(Object.create({approved:true}),fixture()),
    (()=>{const o=fixture();delete o.expected;return o;})()
  ]){
    try{
      compareReleaseEvidence(changed);
      assert.fail('malformed release evidence unexpectedly accepted');
    }catch(error){
      assert.doesNotMatch(String(error),/PRIVATE_F294_LEAK/);
    }
  }
  assert.throws(()=>compareReleaseEvidence({}),/valid F38/);
  assert.throws(()=>compareReleaseEvidence(null),/invalid review input container/);
});

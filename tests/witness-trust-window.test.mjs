import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {receiptSigningBytes} from '../src/lib/independent-delivery-receipt.mjs';
import {verifyReceiptWithWitnessTrustWindow} from '../src/lib/witness-trust-window.mjs';
import {createSyntheticAtomicLedger} from '../src/lib/atomic-receipt-ledger.mjs';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const key=publicKey.export({type:'spki',format:'pem'});
const now=1800000000;
const expected={releaseId:'release_lab_01',target:'staging',treeSha256:'a'.repeat(64),witnessKeyId:'witness_lab_01'};
const policy=()=>({schema:'imagine.comercial.witness-trust-window.v1',
 witnessKeyId:'witness_lab_01',publicKeyPem:key,state:'active',
 validFrom:now-3600,validUntil:now+3600});
function receipt(changes={}){
 const value={schema:'imagine.comercial.delivery-receipt.v1',...expected,
  issuedAt:now,nonce:'b'.repeat(64),...changes};
 return {...value,signature:sign(null,receiptSigningBytes(value),privateKey).toString('base64')};
}
function args(changes={}){
 return {receipt:receipt(),expected,policy:policy(),
 publisherKeyId:'portal_lab_01',nowSeconds:now,
 ledger:createSyntheticAtomicLedger(),...changes};
}
test('F44 active witness window permits synthetically signed receipt but never deploy',async()=>{
 const result=await verifyReceiptWithWitnessTrustWindow(args());
 assert.equal(result.replayReserved,true);
 assert.equal(result.deploymentAuthorized,false);
 assert.match(result.status,/LAB_ONLY/);
});
test('F44 revoked and suspended keys fail before ledger reservation',async()=>{
 for(const state of ['revoked','suspended']){
  let reserved=0;
  await assert.rejects(verifyReceiptWithWitnessTrustWindow(args({
   policy:{...policy(),state},
   ledger:{reserveOnce:async()=>{reserved++;return true;}}
  })),/inactive or revoked/);
  assert.equal(reserved,0);
 }
});
test('F44 rejects past, future, or rotated-out key windows',async()=>{
 for(const variant of [
  {validFrom:now+1,validUntil:now+500},
  {validFrom:now-1000,validUntil:now},
  {validFrom:now-1000,validUntil:now-1}
 ]){
  await assert.rejects(verifyReceiptWithWitnessTrustWindow(args({
   policy:{...policy(),...variant}
  })),/timestamp outside active key window/);
 }
});
test('F44 rejects witness key-id mismatch, malformed policy and wrong key',async()=>{
 await assert.rejects(verifyReceiptWithWitnessTrustWindow(args({
  policy:{...policy(),witnessKeyId:'other_key_01'}
 })),/key identity mismatch/);
 await assert.rejects(verifyReceiptWithWitnessTrustWindow(args({
  policy:{...policy(),unexpected:true}
 })),/invalid independently sourced/);
 await assert.rejects(verifyReceiptWithWitnessTrustWindow(args({
  policy:{...policy(),publicKeyPem:'not a key'}
 })),/public key/);
});
test('F44 preserves F41 replay rejection across repeated verification',async()=>{
 const ledger=createSyntheticAtomicLedger();
 const first=args({ledger});
 await verifyReceiptWithWitnessTrustWindow(first);
 await assert.rejects(verifyReceiptWithWitnessTrustWindow(first),/replay rejected/);
});

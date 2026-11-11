import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {receiptSigningBytes,verifyIndependentDeliveryReceipt} from '../src/lib/independent-delivery-receipt.mjs';

const witness=generateKeyPairSync('ed25519');
const outsider=generateKeyPairSync('ed25519');
const publicKey=witness.publicKey.export({type:'spki',format:'pem'});
const tree='a'.repeat(64);
const now=1800000000;
function fixture(changes={}){
 const payload={schema:'imagine.comercial.delivery-receipt.v1',
  releaseId:'release_test_01',target:'staging',treeSha256:tree,
  witnessKeyId:'witness_lab_01',issuedAt:now,nonce:'b'.repeat(64),...changes};
 const signature=sign(null,receiptSigningBytes(payload),witness.privateKey).toString('base64');
 return {...payload,signature};
}
function verify(receipt,changes={}){
 return verifyIndependentDeliveryReceipt({receipt,expected:{
  releaseId:'release_test_01',target:'staging',treeSha256:tree,
  witnessKeyId:'witness_lab_01'},
  witnessKeys:new Map([['witness_lab_01',publicKey]]),
  publisherKeyId:'portal_lab_01',nowSeconds:now,seenNonces:new Set(),...changes});
}
test('F39 accepts matching synthetic independent witness only as lab evidence',()=>{
 const result=verify(fixture());
 assert.equal(result.verified,true);
 assert.equal(result.deploymentAuthorized,false);
 assert.match(result.status,/LAB_ONLY/);
});
test('F39 rejects forged and modified receipts',()=>{
 const receipt=fixture();
 for(const changed of [{treeSha256:'c'.repeat(64)},{target:'production'},
   {releaseId:'release_other_01'},{nonce:'d'.repeat(64)}]){
   assert.throws(()=>verify({...receipt,...changed}),/pin|signature/);
 }
 assert.throws(()=>verify({...receipt,unexpected:true}),/schema/);
 const forged=fixture();
 forged.signature=sign(null,receiptSigningBytes((({signature,...rest})=>rest)(forged)),outsider.privateKey).toString('base64');
 assert.throws(()=>verify(forged),/signature/);
});
test('F39 enforces independent identity and trust inputs',()=>{
 assert.throws(()=>verify(fixture(),{publisherKeyId:'witness_lab_01'}),/distinct/);
 assert.throws(()=>verify(fixture(),{witnessKeys:new Map()}),/distinct/);
 assert.throws(()=>verify(fixture(),{expected:{releaseId:'release_other_01',target:'staging',treeSha256:tree,witnessKeyId:'witness_lab_01'}}),/pin/);
 assert.throws(()=>verify(fixture(),{witnessKeys:new Map([['witness_lab_01','bad key']])}),/public key/);
});
test('F39 rejects old and future receipts',()=>{
 assert.throws(()=>verify(fixture({issuedAt:now-301})),/time window/);
 assert.throws(()=>verify(fixture({issuedAt:now+1})),/time window/);
});
test('F39 detects receipt nonce replay in the supplied ledger',()=>{
 const seenNonces=new Set();
 verify(fixture(),{seenNonces});
 assert.throws(()=>verify(fixture(),{seenNonces}),/replay/);
 assert.equal(seenNonces.size,1);
});
test('F39 rejects invalid signature and timestamp formats',()=>{
 const r=fixture();
 assert.throws(()=>verify({...r,signature:'AAAA'}),/signature encoding/);
 assert.throws(()=>verify({...r,issuedAt:'1800000000'}),/signed fields/);
 assert.throws(()=>verify({...r,nonce:'x'.repeat(64)}),/signed fields/);
});

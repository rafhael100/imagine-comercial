import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {receiptSigningBytes} from '../src/lib/independent-delivery-receipt.mjs';
import {verifyReceiptWithAtomicReplayLedger,createSyntheticAtomicLedger} from '../src/lib/atomic-receipt-ledger.mjs';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const witnessPem=publicKey.export({type:'spki',format:'pem'});
const time=1800000000;
const expected={releaseId:'release_lab_01',target:'staging',treeSha256:'a'.repeat(64),witnessKeyId:'witness_lab_01'};
function receipt(changes={}){
 const p={schema:'imagine.comercial.delivery-receipt.v1',
  ...expected,issuedAt:time,nonce:'b'.repeat(64),...changes};
 return {...p,signature:sign(null,receiptSigningBytes(p),privateKey).toString('base64')};
}
const args=(ledger)=>({receipt:receipt(),expected,witnessKeys:new Map([['witness_lab_01',witnessPem]]),
 publisherKeyId:'portal_lab_01',nowSeconds:time,ledger});
test('F41 accepts first signed receipt, rejects replay across calls',async()=>{
 const ledger=createSyntheticAtomicLedger();
 const first=await verifyReceiptWithAtomicReplayLedger(args(ledger));
 assert.equal(first.replayReserved,true);
 assert.equal(first.deploymentAuthorized,false);
 await assert.rejects(verifyReceiptWithAtomicReplayLedger(args(ledger)),/replay rejected/);
});
test('F41 synthetic adapter is atomic for concurrent attempts in one process',async()=>{
 const ledger=createSyntheticAtomicLedger();
 const results=await Promise.allSettled(Array.from({length:10},()=>verifyReceiptWithAtomicReplayLedger(args(ledger))));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.filter(r=>r.status==='rejected').length,9);
});
test('F41 fails closed for absent, failing and nonboolean ledger adapters',async()=>{
 await assert.rejects(verifyReceiptWithAtomicReplayLedger(args(undefined)),/adapter required/);
 await assert.rejects(verifyReceiptWithAtomicReplayLedger(args({reserveOnce:async()=>{throw Error('db down')}})),/ledger unavailable/);
 await assert.rejects(verifyReceiptWithAtomicReplayLedger(args({reserveOnce:async()=>undefined})),/invalid acknowledgement/);
});
test('F41 does not reserve invalidly signed or mismatched receipts',async()=>{
 let called=0;
 const ledger={reserveOnce:async()=>{called++;return true}};
 const original=receipt();
 await assert.rejects(verifyReceiptWithAtomicReplayLedger({...args(ledger),receipt:{...original,treeSha256:'c'.repeat(64)}}),/pin/);
 assert.equal(called,0);
 await assert.rejects(verifyReceiptWithAtomicReplayLedger({...args(ledger),receipt:{...original,signature:'AAAA'}}),/signature/);
 assert.equal(called,0);
});
test('F41 allows different distinct nonces',async()=>{
 const ledger=createSyntheticAtomicLedger();
 await verifyReceiptWithAtomicReplayLedger(args(ledger));
 const other=receipt({nonce:'c'.repeat(64)});
 const result=await verifyReceiptWithAtomicReplayLedger({...args(ledger),receipt:other});
 assert.equal(result.replayReserved,true);
});

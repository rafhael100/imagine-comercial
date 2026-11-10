import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {receiptSigningBytes} from '../src/lib/independent-delivery-receipt.mjs';
import {createSyntheticAtomicLedger} from '../src/lib/atomic-receipt-ledger.mjs';
import {
 witnessPolicySigningBytes,verifySignedWitnessPolicy,
 verifyReceiptWithSignedWitnessPolicy
} from '../src/lib/signed-witness-trust-policy.mjs';

const root=generateKeyPairSync('ed25519');
const outsider=generateKeyPairSync('ed25519');
const witness=generateKeyPairSync('ed25519');
const pem=key=>key.export({type:'spki',format:'pem'});
const now=1800000000;
const expected={releaseId:'release_lab_01',target:'staging',
 treeSha256:'a'.repeat(64),witnessKeyId:'witness_lab_01'};
const roots=new Map([['trust_root_lab_01',pem(root.publicKey)]]);
function policy(changes={}){
 return {schema:'imagine.comercial.witness-trust-window.v1',
 witnessKeyId:'witness_lab_01',publicKeyPem:pem(witness.publicKey),
 state:'active',validFrom:now-120,validUntil:now+120,...changes};
}
function signedPolicy(changes={},key=root.privateKey){
 const unsigned={schema:'imagine.comercial.signed-witness-policy.v1',
  signerKeyId:'trust_root_lab_01',sequence:12,policy:policy(),...changes};
 return {...unsigned,signature:sign(null,witnessPolicySigningBytes(unsigned),key).toString('base64')};
}
function receipt(changes={}){
 const payload={schema:'imagine.comercial.delivery-receipt.v1',
  ...expected,issuedAt:now,nonce:'b'.repeat(64),...changes};
 return {...payload,signature:sign(null,receiptSigningBytes(payload),
  witness.privateKey).toString('base64')};
}
function args(changes={}){
 return {receipt:receipt(),expected,envelope:signedPolicy(),rootKeys:roots,
  expectedRootKeyId:'trust_root_lab_01',minSequence:12,
  publisherKeyId:'portal_lab_01',nowSeconds:now,
  ledger:createSyntheticAtomicLedger(),...changes};
}
test('F45 validates root-signed policy, witness signature, window and replay',async()=>{
 const result=await verifyReceiptWithSignedWitnessPolicy(args());
 assert.equal(result.policySequence,12);
 assert.equal(result.deploymentAuthorized,false);
 assert.equal(result.deploymentPerformed,false);
 assert.equal(result.replayReserved,true);
 assert.match(result.status,/LAB_ONLY/);
});
test('F45 rejects tampered trust policy and root signer substitution',()=>{
 const valid=signedPolicy();
 for(const update of [
  {policy:{...valid.policy,state:'revoked'}},
  {policy:{...valid.policy,validUntil:now+3600}},
  {sequence:13},{signerKeyId:'other_root_01'}
 ]){
  assert.throws(()=>verifySignedWitnessPolicy({
   ...args(),envelope:{...valid,...update}
  }),/signature|root/);
 }
 assert.throws(()=>verifySignedWitnessPolicy({
  ...args(),envelope:signedPolicy({},outsider.privateKey)
 }),/signature/);
});
test('F45 fails closed on rollback and unpinned trust anchor',()=>{
 const valid=signedPolicy();
 assert.throws(()=>verifySignedWitnessPolicy({...args(),minSequence:13}),/stale/);
 assert.throws(()=>verifySignedWitnessPolicy({...args(),minSequence:undefined}),/stale/);
 assert.throws(()=>verifySignedWitnessPolicy({...args(),rootKeys:new Map()}),/root/);
 assert.throws(()=>verifySignedWitnessPolicy({...args(),expectedRootKeyId:'other_root_01'}),/root/);
 assert.throws(()=>verifySignedWitnessPolicy({...args(),envelope:{...valid,extra:true}}),/schema/);
});
test('F45 valid root signature does not override revoked witness key',async()=>{
 const envelope=signedPolicy({policy:policy({state:'revoked'})});
 await assert.rejects(verifyReceiptWithSignedWitnessPolicy(args({envelope})),/inactive or revoked/);
});
test('F45 signed policy cannot be repurposed for a different witness or release',async()=>{
 const r=receipt({nonce:'c'.repeat(64)});
 await assert.rejects(verifyReceiptWithSignedWitnessPolicy(args({
  receipt:r,expected:{...expected,releaseId:'different_release_01'}
 })),/pin/);
 await assert.rejects(verifyReceiptWithSignedWitnessPolicy(args({
  expected:{...expected,witnessKeyId:'different_witness_01'}
 })),/key identity mismatch/);
});
test('F45 rejects duplicate receipt against the same ledger',async()=>{
 const ledger=createSyntheticAtomicLedger();
 const input=args({ledger});
 await verifyReceiptWithSignedWitnessPolicy(input);
 await assert.rejects(verifyReceiptWithSignedWitnessPolicy(input),/replay rejected/);
});

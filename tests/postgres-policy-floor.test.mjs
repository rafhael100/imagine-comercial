import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {receiptSigningBytes} from '../src/lib/independent-delivery-receipt.mjs';
import {witnessPolicySigningBytes} from '../src/lib/signed-witness-trust-policy.mjs';
import {
  RESERVE_SIGNED_POLICY_NONCE_SQL,PROMOTE_SIGNED_POLICY_SQL,
  createPostgresPolicyBoundReplayLedger,promoteAuthenticatedSignedPolicy,
  verifyReceiptWithPostgresPolicyFloor
} from '../src/lib/postgres-policy-floor.mjs';

const now=1800000000,root=generateKeyPairSync('ed25519'),
  witness=generateKeyPairSync('ed25519');
const key=k=>k.export({type:'spki',format:'pem'}).toString();
const rootId='trust_root_ci_01', witnessId='witness_ci_01';
const rootKeys=new Map([[rootId,key(root.publicKey)]]);
const expected={
  releaseId:'release_ci_01',target:'staging',
  treeSha256:'f'.repeat(64),witnessKeyId:witnessId
};
function signedPolicy(seq=20,state='active',changed={}){
  const policy={
    schema:'imagine.comercial.witness-trust-window.v1',
    witnessKeyId:witnessId,publicKeyPem:key(witness.publicKey),
    state,validFrom:now-100,validUntil:now+100,...changed
  };
  const unsigned={
    schema:'imagine.comercial.signed-witness-policy.v1',
    signerKeyId:rootId,sequence:seq,policy
  };
  return {...unsigned,signature:sign(null,
    witnessPolicySigningBytes(unsigned),root.privateKey).toString('base64')};
}
function receipt(nonce='a'.repeat(64)){
  const p={schema:'imagine.comercial.delivery-receipt.v1',...expected,issuedAt:now,nonce};
  return {...p,signature:sign(null,receiptSigningBytes(p),witness.privateKey)
    .toString('base64')};
}
const paramsOf=envelope=>({
 signerKeyId:envelope.signerKeyId,
 witnessKeyId:envelope.policy.witnessKeyId,
 sequence:envelope.sequence,
 policySha256:createHash('sha256').update(witnessPolicySigningBytes(envelope)).digest('hex')
});
const args=(db,envelope=signedPolicy())=>({
 db,receipt:receipt(),expected,envelope,rootKeys,
 expectedRootKeyId:rootId,minSequence:1,
 publisherKeyId:'portal_ci_01',nowSeconds:now
});

test('F54 SQL checks policy sequence/digest and nonce in one DB statement',()=>{
 assert.match(RESERVE_SIGNED_POLICY_NONCE_SQL,/WITH floor_guard AS/);
 assert.match(RESERVE_SIGNED_POLICY_NONCE_SQL,/nonce_guard AS/);
 assert.match(RESERVE_SIGNED_POLICY_NONCE_SQL,/SELECT \$2,\$5,\$6,\$7 FROM floor_guard/);
 for(const sql of [RESERVE_SIGNED_POLICY_NONCE_SQL,PROMOTE_SIGNED_POLICY_SQL]){
  assert.match(sql,/existing.sequence < EXCLUDED.sequence/);
  assert.match(sql,/existing.policy_sha256=EXCLUDED.policy_sha256/);
  assert.match(sql,/ON CONFLICT \(signer_key_id,witness_key_id\)/);
 }
 assert.doesNotMatch(RESERVE_SIGNED_POLICY_NONCE_SQL,/\bDELETE\b|\bTRUNCATE\b/);
});
test('F54 verifies root signature before SQL mutation, including revoked policies',async()=>{
 let n=0;
 const db={query:async(sql,values)=>{
  n++; assert.equal(sql,PROMOTE_SIGNED_POLICY_SQL);
  assert.deepEqual(values,[
   rootId,witnessId,21,paramsOf(signedPolicy(21,'revoked')).policySha256
  ]);
  return {rowCount:1,rows:[{policy_ok:'1'}]};
 }};
 const revoked=signedPolicy(21,'revoked');
 const result=await promoteAuthenticatedSignedPolicy({
  db,envelope:revoked,rootKeys,expectedRootKeyId:rootId,minSequence:1
 });
 assert.equal(n,1);
 assert.equal(result.state,'revoked');
 assert.equal(result.deploymentAuthorized,false);
 await assert.rejects(promoteAuthenticatedSignedPolicy({
  db,envelope:{...revoked,sequence:25},
  rootKeys,expectedRootKeyId:rootId,minSequence:1
 }),/invalid root signature/);
 assert.equal(n,1,'invalid root signature must not write DB');
});
test('F54 accepts same authenticated policy and valid receipt, rejecting replay',async()=>{
 const policy=signedPolicy();
 let writes=0;
 const db={query:async(sql,values)=>{
  assert.equal(sql,RESERVE_SIGNED_POLICY_NONCE_SQL);
  assert.deepEqual(values,[
   rootId,witnessId,20,paramsOf(policy).policySha256,
   'a'.repeat(64),now,expected.releaseId
  ]);
  writes++;
  return {rowCount:1,rows:[{
   policy_ok:'1',receipt_inserted:writes===1?'1':'0'
  }]};
 }};
 const first=await verifyReceiptWithPostgresPolicyFloor(args(db,policy));
 assert.equal(first.replayReserved,true);
 assert.equal(first.deploymentAuthorized,false);
 await assert.rejects(verifyReceiptWithPostgresPolicyFloor(args(db,policy)),/replay rejected/);
 assert.equal(writes,2);
});
test('F54 rejects stale/equivocated policy floor and malformed database acks',async()=>{
 const p=paramsOf(signedPolicy());
 const record={witnessKeyId:witnessId,nonce:'a'.repeat(64),
  issuedAt:now,releaseId:expected.releaseId};
 for(const reply of [
  {rowCount:1,rows:[{policy_ok:'0',receipt_inserted:'0'}]},
  {rowCount:1,rows:[{policy_ok:'0',receipt_inserted:'1'}]},
  {rowCount:0,rows:[]},
  {rowCount:1,rows:[{policy_ok:'maybe',receipt_inserted:'1'}]}
 ]){
  const ledger=createPostgresPolicyBoundReplayLedger({
   query:async()=>reply
  },p);
  await assert.rejects(ledger.reserveOnce(record),
    /stale sequence|impossible acknowledgement|invalid database acknowledgement/);
 }
});
test('F54 refuses invalid receipt and signer values before any SQL',async()=>{
 let writes=0;
 const db={query:async()=>{writes++;return {rowCount:1,rows:[]};}};
 const ledger=createPostgresPolicyBoundReplayLedger(db,paramsOf(signedPolicy()));
 for(const value of [
  {...receipt('b'.repeat(64)),extra:true},
  {witnessKeyId:'wrong_ci_01',nonce:'a'.repeat(64),issuedAt:now,releaseId:expected.releaseId},
  {witnessKeyId:witnessId,nonce:'a'.repeat(64),issuedAt:-1,releaseId:expected.releaseId},
  {witnessKeyId:witnessId,nonce:'a'.repeat(64),issuedAt:now,releaseId:'x\';DROP TABLE'}
 ]){
  await assert.rejects(ledger.reserveOnce(value),/invalid receipt/);
 }
 assert.equal(writes,0);
 assert.throws(()=>createPostgresPolicyBoundReplayLedger(db,{
  ...paramsOf(signedPolicy()),policySha256:'INVALID'
 }),/invalid authenticated policy parameters/);
});
test('F54 explicit promotion fails closed on conflicting sequence and DB outage',async()=>{
 const policy=signedPolicy();
 await assert.rejects(promoteAuthenticatedSignedPolicy({
  ...args({query:async()=>({rowCount:1,rows:[{policy_ok:'0'}]})},policy)
 }),/stale sequence or conflicting/);
 await assert.rejects(promoteAuthenticatedSignedPolicy({
  ...args({query:async()=>{throw new Error('postgres down');}},policy)
 }),/postgres down/);
});

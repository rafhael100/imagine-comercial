/**
 * F55: REAL PostgreSQL execute-only role exercised via F54 signed policy API.
 * This is a disposable CI test; the psql transport below is NOT application
 * code and does not contact external PostgreSQL hosts.
 */
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {witnessPolicySigningBytes,verifyReceiptWithSignedWitnessPolicy} from
  '../src/lib/signed-witness-trust-policy.mjs';
import {receiptSigningBytes} from '../src/lib/independent-delivery-receipt.mjs';
import {verifyReceiptWithPostgresPolicyFloor,promoteAuthenticatedSignedPolicy} from
  '../src/lib/postgres-policy-floor.mjs';
import {
  createExecuteOnlyPolicyFloorClient,
  EXECUTE_SIGNED_POLICY_PROMOTION_SQL,EXECUTE_SIGNED_NONCE_RESERVATION_SQL
} from '../src/lib/execute-only-policy-floor.mjs';
if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.RUNNER_ENVIRONMENT!=='github-hosted'||
   process.env.IMAGINE_EPHEMERAL_PG_TEST!=='1')
  throw new Error('F55: execute-only integration requires disposable GitHub-hosted CI');

const exec=promisify(execFile),role='imagine_comercial_ci_execute_only';
const fixture=/^[A-Za-z0-9._:-]+$/;
function quote(value){
 if(typeof value==='number'&&Number.isSafeInteger(value)&&value>0)return String(value);
 if(typeof value!=='string'||!fixture.test(value))throw new Error('F55 invalid local fixture');
 return "'"+value+"'";
}
async function psql(sql){
 const {stdout}=await exec('sudo',[
  '-u','postgres','psql','-X','-qAt','-v','ON_ERROR_STOP=1',
  '-d','imagine_comercial_ci','-c',sql
 ],{timeout:20000,maxBuffer:16384,env:{PATH:process.env.PATH}});
 return stdout.trim();
}
function rawClient(){
 return Object.freeze({
  async query(sql,params){
   const isPromote=sql===EXECUTE_SIGNED_POLICY_PROMOTION_SQL;
   assert.ok(isPromote||sql===EXECUTE_SIGNED_NONCE_RESERVATION_SQL);
   assert.equal(params.length,isPromote?4:7);
   const types=isPromote?'text,text,bigint,text':'text,text,bigint,text,text,bigint,text';
   const statement='SET ROLE '+role+'; PREPARE f55('+types+') AS '+
     sql+'; EXECUTE f55('+params.map(quote).join(',')+');';
   const vals=(await psql(statement)).split('|');
   assert.equal(vals.length,isPromote?1:2);
   return {rowCount:1,rows:[isPromote?
    {policy_ok:vals[0]}:{policy_ok:vals[0],receipt_inserted:vals[1]}]};
  }
 });
}
const db=createExecuteOnlyPolicyFloorClient(rawClient());
const root=generateKeyPairSync('ed25519'),
  witness=generateKeyPairSync('ed25519'),
  rootId='root_f55_ci_01',witnessId='witness_f55_ci_01',
  now=1800000000;
const rootPem=root.publicKey.export({type:'spki',format:'pem'}).toString();
const witnessPem=witness.publicKey.export({type:'spki',format:'pem'}).toString();
const rootKeys=new Map([[rootId,rootPem]]);
const expected={
 releaseId:'release_f55_ci_01',target:'staging',
 treeSha256:'d'.repeat(64),witnessKeyId:witnessId
};
function envelope(sequence,state='active',changes={}){
 const unsigned={
  schema:'imagine.comercial.signed-witness-policy.v1',
  signerKeyId:rootId,sequence,
  policy:{schema:'imagine.comercial.witness-trust-window.v1',
   witnessKeyId:witnessId,publicKeyPem:witnessPem,state,
   validFrom:now-120,validUntil:now+120,...changes}
 };
 return {...unsigned,signature:sign(null,witnessPolicySigningBytes(unsigned),
   root.privateKey).toString('base64')};
}
function receipt(nonce){
 const body={
  schema:'imagine.comercial.delivery-receipt.v1',
  ...expected,issuedAt:now,nonce
 };
 return {...body,signature:sign(null,receiptSigningBytes(body),
  witness.privateKey).toString('base64')};
}
const args=(policy,nonce)=>({
 db,receipt:receipt(nonce),expected,envelope:policy,rootKeys,
 expectedRootKeyId:rootId,minSequence:1,publisherKeyId:'portal_ci_01',
 nowSeconds:now
});
const v30=envelope(30);
const concurrency=await Promise.allSettled(Array.from({length:8},()=>
 verifyReceiptWithPostgresPolicyFloor(args(v30,'a'.repeat(64)))
));
assert.equal(concurrency.filter(x=>x.status==='fulfilled').length,1,
 'exactly one signed receipt accepted with execute-only DB role');
assert.equal(concurrency.filter(x=>x.status==='rejected').length,7);
for(const result of concurrency){
 if(result.status==='fulfilled'){
  assert.equal(result.value.replayReserved,true);
  assert.equal(result.value.deploymentAuthorized,false);
 }else assert.match(String(result.reason),/replay rejected/);
}
await verifyReceiptWithPostgresPolicyFloor(args(v30,'b'.repeat(64)));
const revoked=await promoteAuthenticatedSignedPolicy({
 db,envelope:envelope(31,'revoked'),rootKeys,
 expectedRootKeyId:rootId,minSequence:1
});
assert.equal(revoked.state,'revoked');
assert.equal(revoked.deploymentAuthorized,false);
await assert.rejects(
 verifyReceiptWithPostgresPolicyFloor(args(v30,'c'.repeat(64))),
 /ledger unavailable, fail closed/
);
await assert.rejects(promoteAuthenticatedSignedPolicy({
 db,envelope:envelope(31,'active'),rootKeys,
 expectedRootKeyId:rootId,minSequence:1
}),/stale sequence or conflicting policy digest/);
await assert.rejects(promoteAuthenticatedSignedPolicy({
 db,envelope:{...envelope(32),sequence:33},rootKeys,
 expectedRootKeyId:rootId,minSequence:1
}),/invalid root signature/);
const floor=await psql("SELECT sequence FROM public.imagine_comercial_witness_policy_floor "+
 "WHERE signer_key_id='"+rootId+"' AND witness_key_id='"+witnessId+"'");
assert.equal(floor,'31');
const count=await psql("SELECT count(*) FROM public.imagine_comercial_witness_replay_nonce "+
 "WHERE witness_key_id='"+witnessId+"'");
assert.equal(count,'2');
console.log('F55: execute-only role verified 8 concurrent signed attempts, revocation and denied rollback on REAL PostgreSQL.');

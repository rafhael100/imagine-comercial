/**
 * F51 — exercise the actual PostgreSQL 16 engine on disposable GH hosted CI.
 * The psql shim is STRICTLY TEST-ONLY. It uses the EXACT INSERT statement
 * exported by F49 as a server PREPARE and injects validated fixture params.
 * Production requires a real parameter-binding pg client, never this shim.
 */
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {receiptSigningBytes} from '../src/lib/independent-delivery-receipt.mjs';
import {
  RESERVE_SIGNED_POLICY_NONCE_SQL,PROMOTE_SIGNED_POLICY_SQL,
  verifyReceiptWithPostgresPolicyFloor,promoteAuthenticatedSignedPolicy
} from '../src/lib/postgres-policy-floor.mjs';
import {witnessPolicySigningBytes,verifyReceiptWithSignedWitnessPolicy} from '../src/lib/signed-witness-trust-policy.mjs';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {
  createPostgresWitnessReplayLedger, INSERT_WITNESS_NONCE_SQL
} from '../src/lib/postgres-witness-replay-ledger.mjs';

if (process.env.GITHUB_ACTIONS!=='true' ||
    process.env.RUNNER_ENVIRONMENT!=='github-hosted' ||
    process.env.IMAGINE_EPHEMERAL_PG_TEST!=='1') {
  throw new Error('F51: this real PostgreSQL fixture is CI-hosted only');
}
const exec=promisify(execFile);
const DB='imagine_comercial_ci';
const DB_ROLE='imagine_comercial_ci_writer';
const FIXTURE=/^[a-zA-Z0-9._:-]+$/;
const HEX=/^[0-9a-f]{64}$/;
async function psql(sql){
  const {stdout}=await exec('sudo',[
    '-u','postgres','psql','-X','-qAt','-v','ON_ERROR_STOP=1',
    '-d',DB,'-c',sql
  ],{timeout:20000,maxBuffer:16384,env:{PATH:process.env.PATH}});
  return stdout.trim();
}
function quoteFixture(value){
  // The production adapter uses PostgreSQL parameter binding. This shim
  // only builds a PREPARE/EXECUTE with locally generated safe CI fixtures.
  if(typeof value==='number'&&Number.isSafeInteger(value)&&value>0)return String(value);
  if(typeof value!=='string'||!FIXTURE.test(value))
    throw new Error('F51 invalid test fixture');
  return "'"+value+"'";
}
function makeClient(){
  return Object.freeze({
    async query(sql,params){
      assert.equal(sql,INSERT_WITNESS_NONCE_SQL);
      assert.equal(params?.length,4);
      assert.ok(HEX.test(params[1]));
      const prepared='SET ROLE '+DB_ROLE+'; PREPARE r(text,text,bigint,text) AS '+
        sql+'; EXECUTE r('+params.map(quoteFixture).join(',')+');';
      const output=await psql(prepared);
      if(output==='')return {rowCount:0,rows:[]};
      const fields=output.split('|');
      assert.equal(fields.length,2);
      return {rowCount:1,rows:[{
        witness_key_id:fields[0],nonce:fields[1]
      }]};
    }
  });
}
const source=()=>({
  witnessKeyId:'witness_ci_01',nonce:'c'.repeat(64),
  issuedAt:1800000000,releaseId:'release_ci_01'
});
const first=createPostgresWitnessReplayLedger(makeClient());
const second=createPostgresWitnessReplayLedger(makeClient());
const outcomes=await Promise.all(Array.from({length:12},(_,i)=>
  (i%2===0?first:second).reserveOnce(source())));
assert.equal(outcomes.filter(Boolean).length,1,'exactly one winner across 12 real DB sessions');
assert.equal(outcomes.filter(value=>value===false).length,11);
assert.equal(await second.reserveOnce(source()),false,'new session must see persisted replay');
assert.equal(await first.reserveOnce({...source(),witnessKeyId:'witness_ci_02'}),true,
  'uniqueness key must include witness identity');
assert.equal(await second.reserveOnce({...source(),nonce:'d'.repeat(64)}),true,
  'different nonce must be accepted');
const count=await psql('SELECT count(*) FROM imagine_comercial_witness_replay_nonce');
assert.equal(count,'3','database must contain only three unique reservations');
const badSql=psql("SET ROLE "+DB_ROLE+"; INSERT INTO imagine_comercial_witness_replay_nonce "+
  "(witness_key_id,nonce,issued_at,release_id) VALUES ('witness_ci_01','invalid',1800000000,'release_ci_01');");
await assert.rejects(badSql,/constraint|psql|command failed/i);
assert.equal(await psql('SELECT count(*) FROM imagine_comercial_witness_replay_nonce'),'3');
await assert.rejects(first.reserveOnce({...source(),witnessKeyId:"evil'; DROP TABLE x;--"}),
  /invalid signed receipt reservation/);
// The actual PostgreSQL service is local to this disposable runner; no DNS,
// remote DB, customer data, permissions for deployment, or real receipts.
console.log('F51 real PostgreSQL accepted exactly one nonce per unique key, all 12 attempts checked.');

// F52: exercise a complete ROOT-SIGNED witness receipt through the same
// REAL PostgreSQL adapter and cross-session UNIQUE constraint, not a mock.
const root=generateKeyPairSync('ed25519');
const witness=generateKeyPairSync('ed25519');
const rootPem=root.publicKey.export({type:'spki',format:'pem'}).toString();
const witnessPem=witness.publicKey.export({type:'spki',format:'pem'}).toString();
const now=1800000000;
const expected={
  releaseId:'release_ci_02',target:'staging',treeSha256:'f'.repeat(64),
  witnessKeyId:'witness_ci_03'
};
const rootId='trust_root_ci_01';
const policyBase={
  schema:'imagine.comercial.witness-trust-window.v1',
  witnessKeyId:expected.witnessKeyId,publicKeyPem:witnessPem,
  state:'active',validFrom:now-120,validUntil:now+120
};
function makePolicyEnvelope(state='active'){
  const unsigned={
    schema:'imagine.comercial.signed-witness-policy.v1',
    signerKeyId:rootId,sequence:10,policy:{...policyBase,state}
  };
  return {...unsigned,signature:sign(null,witnessPolicySigningBytes(unsigned),
    root.privateKey).toString('base64')};
}
const receiptPayload={
  schema:'imagine.comercial.delivery-receipt.v1',
  ...expected,issuedAt:now,nonce:'e'.repeat(64)
};
const receipt={...receiptPayload,signature:sign(
  null,receiptSigningBytes(receiptPayload),witness.privateKey
).toString('base64')};
const trustedReceipt={
  receipt,expected,envelope:makePolicyEnvelope(),
  rootKeys:new Map([[rootId,rootPem]]),
  expectedRootKeyId:rootId,minSequence:10,
  publisherKeyId:'portal_ci_01',nowSeconds:now
};
const verifyWithRealDb=(overrides={})=>verifyReceiptWithSignedWitnessPolicy({
  ...trustedReceipt,ledger:createPostgresWitnessReplayLedger(makeClient()),
  ...overrides
});
await assert.rejects(verifyWithRealDb({
  receipt:{...receipt,signature:Buffer.alloc(64,7).toString('base64')}
}),/signature/);
await assert.rejects(verifyWithRealDb({
  envelope:makePolicyEnvelope('revoked')
}),/inactive or revoked/);
await assert.rejects(verifyWithRealDb({minSequence:11}),/stale or missing monotonic sequence/);
await assert.rejects(verifyWithRealDb({
  expected:{...expected,treeSha256:'d'.repeat(64)}
}),/pin/);
assert.equal(await psql('SELECT count(*) FROM imagine_comercial_witness_replay_nonce'),
  '3','bad signatures, revocation and release mismatch must not reserve nonce');
const verified=await Promise.allSettled(
  Array.from({length:8},()=>verifyWithRealDb())
);
assert.equal(verified.filter(x=>x.status==='fulfilled').length,1,
  'F52 must accept only one concurrent signed receipt with real PostgreSQL');
assert.equal(verified.filter(x=>x.status==='rejected').length,7);
for(const outcome of verified){
  if(outcome.status==='fulfilled'){
    assert.equal(outcome.value.replayReserved,true);
    assert.equal(outcome.value.deploymentAuthorized,false);
  }else{
    assert.match(String(outcome.reason),/replay rejected/);
  }
}
await assert.rejects(verifyWithRealDb(),/replay rejected/);
assert.equal(await psql('SELECT count(*) FROM imagine_comercial_witness_replay_nonce'),
  '4','real PostgreSQL contains exactly one signed witness reservation');
console.log('F52: signed Ed25519 witness receipts, revocation, replay and real PostgreSQL concurrency PASS.');


// F54 — signature-authenticated monotonic policy floors, with nonce and
// version in the SAME PostgreSQL statement, across independent psql sessions.
function policySqlClient(){
  return Object.freeze({
    async query(sql,values){
      assert.ok(sql===RESERVE_SIGNED_POLICY_NONCE_SQL||
        sql===PROMOTE_SIGNED_POLICY_SQL,'F54 approved SQL only');
      const isReceipt=sql===RESERVE_SIGNED_POLICY_NONCE_SQL;
      assert.equal(values.length,isReceipt?7:4);
      const declared=isReceipt?
        'text,text,bigint,text,text,bigint,text':'text,text,bigint,text';
      const query='SET ROLE '+DB_ROLE+'; PREPARE policy_f54('+declared+
        ') AS '+sql+'; EXECUTE policy_f54('+values.map(quoteFixture).join(',')+');';
      const result=(await psql(query)).split('|');
      assert.equal(result.length,isReceipt?2:1);
      return {rowCount:1,rows:[isReceipt?
        {policy_ok:result[0],receipt_inserted:result[1]}:
        {policy_ok:result[0]}
      ]};
    }
  });
}
const floorDb=policySqlClient();
function policyF54(sequence,state='active',overrides={}){
  const unsigned={
    schema:'imagine.comercial.signed-witness-policy.v1',
    signerKeyId:rootId,sequence,
    policy:{...policyBase,state,...overrides}
  };
  return {...unsigned,signature:sign(null,
    witnessPolicySigningBytes(unsigned),root.privateKey).toString('base64')};
}
function receiptF54(nonce){
  const data={
    schema:'imagine.comercial.delivery-receipt.v1',
    ...expected,issuedAt:now,nonce
  };
  return {...data,signature:sign(null,receiptSigningBytes(data),
    witness.privateKey).toString('base64')};
}
const floorArgs=(envelope,nonce)=>({
  db:floorDb,receipt:receiptF54(nonce),expected,envelope,rootKeys:
    new Map([[rootId,rootPem]]),expectedRootKeyId:rootId,
  minSequence:1,publisherKeyId:'portal_ci_01',nowSeconds:now
});
const active20=policyF54(20);
const signedAttempts=await Promise.allSettled(
  Array.from({length:8},()=>verifyReceiptWithPostgresPolicyFloor(
    floorArgs(active20,'1'.repeat(64))
  ))
);
assert.equal(signedAttempts.filter(x=>x.status==='fulfilled').length,1,
  'F54 one winner across 8 atomic signed policy+nonce transactions');
assert.equal(signedAttempts.filter(x=>x.status==='rejected').length,7);
const currentAfter20=await psql("SELECT sequence FROM imagine_comercial_witness_policy_floor "+
  "WHERE signer_key_id='"+rootId+"' AND witness_key_id='"+expected.witnessKeyId+"'");
assert.equal(currentAfter20,'20');
await verifyReceiptWithPostgresPolicyFloor(
  floorArgs(active20,'2'.repeat(64))
);
const active21=policyF54(21);
await verifyReceiptWithPostgresPolicyFloor(
  floorArgs(active21,'3'.repeat(64))
);
await assert.rejects(verifyReceiptWithPostgresPolicyFloor(
  floorArgs(active20,'4'.repeat(64))
),/ledger unavailable, fail closed/);
await assert.rejects(verifyReceiptWithPostgresPolicyFloor(
  floorArgs(policyF54(21,'active',{validUntil:now+200}),'5'.repeat(64))
),/ledger unavailable, fail closed/);
const revoke=await promoteAuthenticatedSignedPolicy({
  db:floorDb,envelope:policyF54(22,'revoked'),
  rootKeys:new Map([[rootId,rootPem]]),
  expectedRootKeyId:rootId,minSequence:1
});
assert.equal(revoke.state,'revoked');
assert.equal(revoke.deploymentAuthorized,false);
await assert.rejects(verifyReceiptWithPostgresPolicyFloor(
  floorArgs(active21,'6'.repeat(64))
),/ledger unavailable, fail closed/);
await assert.rejects(promoteAuthenticatedSignedPolicy({
  db:floorDb,envelope:active21,
  rootKeys:new Map([[rootId,rootPem]]),
  expectedRootKeyId:rootId,minSequence:1
}),/stale sequence or conflicting/);
const forged=policyF54(23,'active');
await assert.rejects(promoteAuthenticatedSignedPolicy({
  db:floorDb,envelope:{...forged,sequence:24},
  rootKeys:new Map([[rootId,rootPem]]),
  expectedRootKeyId:rootId,minSequence:1
}),/invalid root signature/);
const floorState=await psql(
  "SELECT sequence FROM imagine_comercial_witness_policy_floor "+
  "WHERE signer_key_id='"+rootId+"' AND witness_key_id='"+expected.witnessKeyId+"'"
);
assert.equal(floorState,'22','old signed active policy must not lower a revoked floor');
assert.equal(await psql('SELECT count(*) FROM imagine_comercial_witness_replay_nonce'),
  '7','only three F54 signed reservations added to four earlier F51/F52 entries');
console.log('F54: persisted policy monotonicity, signed revocation, fork guard and concurrent replay PASS.');

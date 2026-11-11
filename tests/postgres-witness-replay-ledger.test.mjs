import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPostgresWitnessReplayLedger,INSERT_WITNESS_NONCE_SQL
} from '../src/lib/postgres-witness-replay-ledger.mjs';

const record=()=>({
  witnessKeyId:'witness_lab_01',
  nonce:'a'.repeat(64),
  issuedAt:1800000000,
  releaseId:'release_lab_01'
});
test('F49 SQL uses atomic constraint, fixed table and parameter placeholders',()=>{
  assert.match(INSERT_WITNESS_NONCE_SQL,/ON CONFLICT \(witness_key_id, nonce\) DO NOTHING/);
  assert.match(INSERT_WITNESS_NONCE_SQL,/VALUES \(\$1, \$2, \$3, \$4\)/);
  assert.doesNotMatch(INSERT_WITNESS_NONCE_SQL,/\bSELECT\b|\bDELETE\b|\bUPDATE\b/);
});
test('F49 passes only signed receipt metadata as parameterized values',async()=>{
  let invoked=0;
  const client={async query(sql,params){
    invoked++;
    assert.equal(sql,INSERT_WITNESS_NONCE_SQL);
    assert.deepEqual(params,Object.values(record()));
    return {rowCount:1,rows:[{
      witness_key_id:params[0],nonce:params[1]
    }]};
  }};
  const ledger=createPostgresWitnessReplayLedger(client);
  assert.equal(await ledger.reserveOnce(record()),true);
  assert.equal(invoked,1);
  assert.ok(Object.isFrozen(ledger));
});
test('F49 recognizes replay and rejects every invalid acknowledgement',async()=>{
 const duplicates=createPostgresWitnessReplayLedger({
  query:async()=>({rowCount:0,rows:[]})
 });
 assert.equal(await duplicates.reserveOnce(record()),false);
 for(const reply of [
   undefined,{rowCount:1},{rowCount:2,rows:[]},
   {rowCount:0,rows:[{}]},{rowCount:1,rows:[]},
   {rowCount:1,rows:[{witness_key_id:'other_witness_01',nonce:'a'.repeat(64)}]},
   {rowCount:1,rows:[{witness_key_id:record().witnessKeyId,nonce:'b'.repeat(64)}]}
 ]){
  const ledger=createPostgresWitnessReplayLedger({query:async()=>reply});
  await assert.rejects(ledger.reserveOnce(record()),/acknowledgement/);
 }
});
test('F49 invalid records never reach database and injection is not interpolated',async()=>{
 let called=0;
 const ledger=createPostgresWitnessReplayLedger({
  query:async()=>{called++;return {rowCount:1,rows:[]};}
 });
 for(const invalid of [
  {...record(),witnessKeyId:"witness'; DROP TABLE x; --"},
  {...record(),nonce:'not-a-nonce'},
  {...record(),issuedAt:1.5},
  {...record(),releaseId:''},
  {...record(),extra:'not signed'},
  Object.assign(Object.create(null),record())
 ]){
  await assert.rejects(ledger.reserveOnce(invalid),/invalid signed receipt reservation/);
 }
 assert.equal(called,0);
});
test('F49 fails closed on database unavailability; no silent in-memory fallback',async()=>{
 assert.throws(()=>createPostgresWitnessReplayLedger({}),/query client/);
 const ledger=createPostgresWitnessReplayLedger({
  query:async()=>{throw new Error('database unavailable');}
 });
 await assert.rejects(ledger.reserveOnce(record()),/database unavailable/);
});
test('F49 independent adapters share a simulated unique index across concurrency',async()=>{
 const persisted=new Set();
 const query=async(sql,[id,nonce])=>{
   const key=id+':'+nonce;
   if(persisted.has(key))return {rowCount:0,rows:[]};
   persisted.add(key);
   return {rowCount:1,rows:[{witness_key_id:id,nonce}]};
 };
 const first=createPostgresWitnessReplayLedger({query});
 const second=createPostgresWitnessReplayLedger({query});
 const accepted=await Promise.all([
   ...Array.from({length:10},(_,i)=> (i%2?first:second).reserveOnce(record()))
 ]);
 assert.equal(accepted.filter(Boolean).length,1);
 assert.equal(accepted.filter(v=>!v).length,9);
});

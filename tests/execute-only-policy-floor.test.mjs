import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createExecuteOnlyPolicyFloorClient,
  EXECUTE_SIGNED_POLICY_PROMOTION_SQL,EXECUTE_SIGNED_NONCE_RESERVATION_SQL
} from '../src/lib/execute-only-policy-floor.mjs';
import {
  PROMOTE_SIGNED_POLICY_SQL,RESERVE_SIGNED_POLICY_NONCE_SQL
} from '../src/lib/postgres-policy-floor.mjs';

test('F55 maps reviewed policy SQL to only two execute-only functions',async()=>{
 const calls=[];
 const restricted=createExecuteOnlyPolicyFloorClient({
  async query(sql,params){
   calls.push({sql,params});
   return {rowCount:1,rows:[{policy_ok:'1',receipt_inserted:'1'}]};
  }
 });
 assert.ok(Object.isFrozen(restricted));
 await restricted.query(PROMOTE_SIGNED_POLICY_SQL,['r','w',1,'a'.repeat(64)]);
 await restricted.query(RESERVE_SIGNED_POLICY_NONCE_SQL,[
  'r','w',1,'a'.repeat(64),'b'.repeat(64),1800000000,'release_lab_01'
 ]);
 assert.deepEqual(calls.map(c=>c.sql),[
  EXECUTE_SIGNED_POLICY_PROMOTION_SQL,EXECUTE_SIGNED_NONCE_RESERVATION_SQL
 ]);
 assert.deepEqual(calls[0].params,['r','w',1,'a'.repeat(64)]);
 assert.equal(calls[1].params.length,7);
});
test('F55 rejects arbitrary SQL and incomplete params before DB',async()=>{
 let calls=0;
 const restricted=createExecuteOnlyPolicyFloorClient({query:async()=>{
  calls++;return {rowCount:1,rows:[]};
 }});
 for(const [sql,params] of [
  ['DROP TABLE imagine_comercial_witness_policy_floor',[]],
  ['SELECT * FROM public.imagine_comercial_witness_policy_floor',[]],
  [PROMOTE_SIGNED_POLICY_SQL,[]],
  [RESERVE_SIGNED_POLICY_NONCE_SQL,['one']]
 ]){
  await assert.rejects(restricted.query(sql,params),/unauthorized SQL|invalid .* parameters/);
 }
 assert.equal(calls,0);
 assert.throws(()=>createExecuteOnlyPolicyFloorClient({}),/query client required/);
});
test('F55 SQL does not read or write raw policy/receipt tables directly',()=>{
 for(const sql of [
  EXECUTE_SIGNED_POLICY_PROMOTION_SQL,EXECUTE_SIGNED_NONCE_RESERVATION_SQL
 ]){
  assert.doesNotMatch(sql,/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b/i);
  assert.doesNotMatch(sql,/policy_floor\s*\bWHERE\b|replay_nonce\b/i);
  assert.match(sql,/^SELECT policy_ok/);
 }
});

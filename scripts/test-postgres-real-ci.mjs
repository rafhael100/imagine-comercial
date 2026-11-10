/**
 * F51 — exercise the actual PostgreSQL 16 engine on disposable GH hosted CI.
 * The psql shim is STRICTLY TEST-ONLY. It uses the EXACT INSERT statement
 * exported by F49 as a server PREPARE and injects validated fixture params.
 * Production requires a real parameter-binding pg client, never this shim.
 */
import assert from 'node:assert/strict';
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

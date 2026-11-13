#!/usr/bin/env node
/**
 * P0-F179: separate psql processes race to reserve one synthetic proof
 * nonce in the SAME disposable GitHub-hosted PostgreSQL database.
 * No production DB, user account, tenant, contact, or permanent migration.
 */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {
  issuePrivateBudgetRequestProofLab as issue,
  inspectPrivateBudgetRequestProofLab as inspect
} from '../src/lib/private-budget-request-proof-lab.mjs';

if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.RUNNER_ENVIRONMENT!=='github-hosted'||
   process.env.IMAGINE_EPHEMERAL_PG_TEST!=='1'||
   ['PGHOST','PGHOSTADDR','PGSERVICE','PGPORT','PGUSER','PGDATABASE','PGPASSWORD']
     .some(key=>process.env[key]))
  throw Error('P0-F179 requires a newly created GitHub-hosted disposable PostgreSQL database');

const run=promisify(execFile);
async function pg(sql){
  const {stdout}=await run('sudo',[
    '-u','postgres','psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1',
    '-d','imagine_comercial_ci','-c',sql
  ],{timeout:18000,maxBuffer:16*1024});
  return stdout.trim();
}
const schema='imagine_budget_proof_ci';
assert.equal(await pg("SELECT to_regclass('"+schema+".claimed_nonce') IS NULL"),'t',
  'P0-F179 must not use any prior table');
await pg('CREATE SCHEMA '+schema+';'+
  'CREATE TABLE '+schema+'.claimed_nonce ('+
  "nonce text PRIMARY KEY CHECK (nonce ~ '^[A-Za-z0-9_-]{24}$'),"+
  'expires_at_ms bigint NOT NULL, claimed_at timestamptz NOT NULL DEFAULT now());');

const key=randomBytes(32),origin='http://127.0.0.1:4321';
const scope='synthetic-private-review-session';
const nowMs=Date.now();
const proof=issue({key,origin,scope,nowMs});
const reserve=async(nonce,expiresAtMs)=>{
  if(typeof nonce!=='string'||!/^[A-Za-z0-9_-]{24}$/.test(nonce)||
     !Number.isSafeInteger(expiresAtMs)||expiresAtMs<nowMs)
    throw Error('P0-F179 refuses nonvalidated database claim input');
  // Nonce is constrained to base64url; timestamp only a safe integer.
  // 12 distinct psql processes/transactions test PostgreSQL UNIQUE.
  return (await pg('INSERT INTO '+schema+'.claimed_nonce (nonce,expires_at_ms) '+
    "VALUES ('"+nonce+"',"+expiresAtMs+') '+
    'ON CONFLICT (nonce) DO NOTHING RETURNING nonce;'))===nonce;
};
const check=(overrides={})=>inspect({
  key,token:proof.token,origin,scope,nowMs:nowMs+150,claimNonce:reserve,
  ...overrides
});
const results=await Promise.all(Array.from({length:12},()=>check()));
assert.equal(results.filter(x=>x.oneTimeNonceClaimedInLab).length,1);
assert.equal(results.filter(x=>x.code==='NONCE_ALREADY_USED_OR_NOT_DURABLE').length,11);
assert.equal(await pg('SELECT count(*) FROM '+schema+'.claimed_nonce;'),'1');
const replay=await check();
assert.equal(replay.code,'NONCE_ALREADY_USED_OR_NOT_DURABLE');
const crossOrigin=await check({origin:'http://127.0.0.1:5432'});
assert.equal(crossOrigin.code,'CONTEXT_MISMATCH');
const expired=await check({nowMs:nowMs+120001});
assert.equal(expired.code,'EXPIRED_OR_FUTURE');
assert.equal(await pg('SELECT count(*) FROM '+schema+'.claimed_nonce;'),'1');
for(const entry of results){
  assert.equal(entry.canDeploy,false);
  assert.equal(entry.publicIntakeAllowed,false);
  assert.equal(entry.canAcknowledgeVisitor,false);
  assert.equal(entry.durableReplayPreventionProven,false,
    'P0-F179 temporary PG test does not prove future runtime persistence');
  assert.ok(!JSON.stringify(entry).includes(proof.token));
}
console.log('P0-F179 PASS: 12 independent psql transactions -> exactly 1 synthetic nonce claim; no intake/deploy.');

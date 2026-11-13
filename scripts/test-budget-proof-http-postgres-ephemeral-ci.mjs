#!/usr/bin/env node
/**
 * P0-F180: real HTTP loopback + HMAC proof + 8 independent PostgreSQL
 * atomic nonce claims; synthetic evidence only, NO customer or CRM intake.
 */
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {startPrivateBudgetReviewLab}
  from '../tests/fixtures/private-budget-http-review-harness.mjs';

if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.RUNNER_ENVIRONMENT!=='github-hosted'||
   process.env.IMAGINE_EPHEMERAL_PG_TEST!=='1'||
   ['PGHOST','PGHOSTADDR','PGSERVICE','PGPORT','PGUSER','PGDATABASE','PGPASSWORD']
     .some(key=>process.env[key]))
  throw Error('P0-F180 refuses external DB or non-disposable CI environment');

const exec=promisify(execFile);
const schema='imagine_budget_proof_http_ci';
async function pg(sql){
  const {stdout}=await exec('sudo',[
    '-u','postgres','psql','-X','-q','-A','-t',
    '-v','ON_ERROR_STOP=1','-d','imagine_comercial_ci','-c',sql
  ],{timeout:18000,maxBuffer:16*1024});
  return stdout.trim();
}
assert.equal(await pg("SELECT to_regclass('"+schema+".claimed_nonce') IS NULL"),'t');
await pg('CREATE SCHEMA '+schema+';'+
  'CREATE TABLE '+schema+'.claimed_nonce ('+
  "nonce text PRIMARY KEY CHECK (nonce ~ '^[A-Za-z0-9_-]{24}$'),"+
  'expires_at_ms bigint NOT NULL);');
const claimNonce=async(nonce,expiresAtMs)=>{
  if(typeof nonce!=='string'||!/^[A-Za-z0-9_-]{24}$/.test(nonce)||
     !Number.isSafeInteger(expiresAtMs)||expiresAtMs<Date.now()-120000)
    throw Error('P0-F180 nonce database claim validation failed');
  return (await pg('INSERT INTO '+schema+'.claimed_nonce(nonce,expires_at_ms) '+
    "VALUES('"+nonce+"',"+expiresAtMs+') '+
    'ON CONFLICT (nonce) DO NOTHING RETURNING nonce;'))===nonce;
};

const password='SYNTHETIC_F180_HTTP_PG_PROOF_2026';
const lab=await startPrivateBudgetReviewLab(password,{
  requireRequestProof:true,claimNonce
});
try{
  const endpoint=new URL(lab.url);
  const auth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
  const origin=endpoint.origin;
  const headers={Authorization:auth,Origin:origin,'Content-Type':'application/json'};
  const ids=[
   'bde4f010-aacf-4ad7-a302-94c507bb1111',
   'bde4f010-aacf-4ad7-a302-94c507bb2222',
   'bde4f010-aacf-4ad7-a302-94c507bb3333',
   'bde4f010-aacf-4ad7-a302-94c507bb4444',
   'bde4f010-aacf-4ad7-a302-94c507bb5555',
   'bde4f010-aacf-4ad7-a302-94c507bb6666'
  ];
  const envelope={
    protocol:'imagine.lead-intake',schema_version:1,
    organization_reference:ids[0],binding_reference:ids[1],
    submission_reference:ids[2],site_reference:ids[3],
    form_reference:ids[4],destination_reference:ids[5]
  };
  const review={
    privateDraft:{name:'Pessoa inteiramente fictícia',role:'',email:'lab@example.invalid',
      phone:'',mobile:'',serviceSlug:'onepage',
      details:'Simulação sem qualquer dado real de cliente.',
      challengePreview:'5',previewUnderstanding:true},
    envelope,storedSnapshot:{original:envelope,phase:'open',version:0},
    expectedVersion:0
  };
  const issue=async()=>{
    const r=await fetch(origin+'/__lab/budget/request-proof',{
      method:'GET',redirect:'manual',headers:{Authorization:auth}
    });
    assert.equal(r.status,200);
    return (await r.json()).requestProof;
  };
  const send=(input,extra={})=>fetch(lab.url,{
    method:'POST',redirect:'manual',headers:{...headers,...extra},
    body:JSON.stringify(input)
  });
  const proof=await issue();
  const noProof=await send(review);
  assert.equal(noProof.status,422);
  assert.equal((await noProof.json()).code,'PROOF_GATED_BODY_SHAPE_REQUIRED');
  assert.equal(await pg('SELECT count(*) FROM '+schema+'.claimed_nonce;'),'0');
  const responses=await Promise.all(Array.from({length:8},()=>send({
    ...review,requestProof:proof
  })));
  const statuses=responses.map(r=>r.status).sort();
  assert.deepEqual(statuses,[200,...Array(7).fill(409)]);
  const bodies=await Promise.all(responses.map(r=>r.json()));
  assert.equal(bodies.filter(x=>x.reasonCode==='ATOMIC_STORE_REQUIRED').length,1);
  assert.equal(bodies.filter(x=>x.code==='SIGNED_REQUEST_PROOF_REQUIRED_OR_USED').length,7);
  assert.ok(bodies.every(x=>x.canSendToCrm===false&&x.canAcknowledgeVisitor===false));
  assert.equal(await pg('SELECT count(*) FROM '+schema+'.claimed_nonce;'),'1');

  // Untrusted Origin must fail BEFORE consuming the newly issued proof.
  const secondProof=await issue();
  assert.equal((await send({...review,requestProof:secondProof},{
    Origin:'https://attacker.invalid'
  })).status,403);
  assert.equal(await pg('SELECT count(*) FROM '+schema+'.claimed_nonce;'),'1');
  const second=await send({...review,requestProof:secondProof});
  assert.equal(second.status,200);
  assert.equal((await second.json()).reasonCode,'ATOMIC_STORE_REQUIRED');
  assert.equal(await pg('SELECT count(*) FROM '+schema+'.claimed_nonce;'),'2');

  for(const body of bodies){
    const json=JSON.stringify(body);
    for(const value of [password,proof,review.privateDraft.email,ids[0]])
      assert.ok(!json.includes(value),'P0-F180 no secret/PII in HTTP diagnostic');
  }
  console.log('P0-F180 PASS: signed budget HTTP -> 8 concurrent PG claims -> exactly 1, no CRM receipt.');
}finally{
  await lab.close();
}

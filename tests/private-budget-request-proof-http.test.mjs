import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {readFileSync} from 'node:fs';
import {startPrivateBudgetRequestProofLab}
  from './fixtures/private-budget-request-proof-http-harness.mjs';

const password='SYNTHETIC_F176_LOOPBACK_ONLY_SECRET_2026';
test('P0-F176 HTTP issues signed one-use proof but rejects replay and unauthorized access',async()=>{
  const lab=await startPrivateBudgetRequestProofLab(password);
  const basic='Basic '+Buffer.from('reviewer:'+password).toString('base64');
  const auth={Authorization:basic};
  const post=(value,headers={})=>fetch(lab.origin+lab.verifyPath,{
    method:'POST',redirect:'manual',headers:{
      ...auth,'Content-Type':'application/json',Origin:lab.origin,...headers
    },body:JSON.stringify(value)
  });
  try{
    const unauth=await fetch(lab.origin+lab.issuePath);
    assert.equal(unauth.status,401);
    assert.match(unauth.headers.get('www-authenticate'),/^Basic/);
    const challenge=await fetch(lab.origin+lab.issuePath,{headers:auth});
    assert.equal(challenge.status,200);
    assert.equal(challenge.headers.get('cache-control'),'private, no-store');
    assert.equal(challenge.headers.get('set-cookie'),null);
    assert.equal(challenge.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
    const issued=await challenge.json();
    assert.equal(issued.code,'SYNTHETIC_PROOF_ISSUED');
    assert.match(issued.token,/^v1\./);
    assert.equal(issued.ttlSeconds,120);
    assert.equal(issued.canCollectPublicLeads,false);
    const accepted=await post({token:issued.token});
    assert.equal(accepted.status,200);
    const receipt=await accepted.json();
    assert.equal(receipt.code,'SYNTHETIC_ONE_TIME_PROOF_VALID');
    assert.equal(receipt.oneTimeNonceClaimedInLab,true);
    assert.equal(receipt.durableReplayPreventionProven,false);
    assert.equal(receipt.captchaOrBotDefenseVerified,false);
    for(const field of ['canCollectPublicLeads','canCreateCrmLead',
      'canAcknowledgeVisitor','canDeploy'])assert.equal(receipt[field],false);
    const duplicate=await post({token:issued.token});
    assert.equal(duplicate.status,409);
    assert.equal((await duplicate.json()).code,'NONCE_ALREADY_USED_OR_NOT_DURABLE');
    const forged=await post({token:issued.token+'x'});
    assert.equal(forged.status,409);
    const leakage=JSON.stringify(receipt);
    for(const privateValue of [password,issued.token,lab.origin])
      assert.equal(leakage.includes(privateValue),false);
  }finally{await lab.close();}
});
test('P0-F176 HTTP rejects origin, host, contact payloads, oversized bodies and methods',async()=>{
  const lab=await startPrivateBudgetRequestProofLab(password);
  const auth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
  const post=(body,headers={})=>fetch(lab.origin+lab.verifyPath,{
    method:'POST',headers:{Authorization:auth,Origin:lab.origin,
      'Content-Type':'application/json',...headers},
    body
  });
  try{
    assert.equal((await post('{"token":"hi"}',{Origin:'https://evil.invalid'})).status,403);
    assert.equal((await post('{"token":"hi"}',{'Content-Type':'text/plain'})).status,415);
    assert.equal((await post('{"token":"hi","email":"x@invalid.example"}')).status,422);
    assert.equal((await post('not-json')).status,400);
    assert.equal((await post('x'.repeat(4096))).status,413);
    assert.equal((await fetch(lab.origin+lab.verifyPath,{headers:{Authorization:auth}})).status,405);
    assert.equal((await fetch(lab.origin+'/unapproved',{headers:{Authorization:auth}})).status,404);
    const forgedHost=await new Promise((resolve,reject)=>{
      const req=httpRequest(lab.origin+lab.issuePath,{
        method:'GET',headers:{Authorization:auth,Host:'evil.invalid'}
      },res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
      req.once('error',reject);req.end();
    });
    assert.equal(forgedHost,421);
  }finally{await lab.close();}
});
test('P0-F176 never bundles lab issue/verify into the public Astro contact page',()=>{
  const publicPage=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  const fixture=readFileSync(
    new URL('./fixtures/private-budget-request-proof-http-harness.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(publicPage,/<form\b|<input\b|<textarea\b|request-proof|private-budget-request-proof|fetch\s*\(/);
  assert.match(fixture,/server\.listen\(0,'127\.0\.0\.1'/);
  assert.doesNotMatch(fixture,/writeFile|createWriteStream|globalThis\.__/);
});

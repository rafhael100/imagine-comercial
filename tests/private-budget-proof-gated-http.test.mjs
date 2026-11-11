import test from 'node:test';
import assert from 'node:assert/strict';
import {startPrivateBudgetReviewLab}
  from './fixtures/private-budget-http-review-harness.mjs';

const password='SYNTHETIC_F177_PROOF_GATED_PRIVATE_REVIEW';
const ids=[
  'bde4f010-aacf-4ad7-a302-94c507bb1111',
  'bde4f010-aacf-4ad7-a302-94c507bb2222',
  'bde4f010-aacf-4ad7-a302-94c507bb3333',
  'bde4f010-aacf-4ad7-a302-94c507bb4444',
  'bde4f010-aacf-4ad7-a302-94c507bb5555',
  'bde4f010-aacf-4ad7-a302-94c507bb6666'
];
const sample=()=>{
  const envelope={
    protocol:'imagine.lead-intake',schema_version:1,
    organization_reference:ids[0],binding_reference:ids[1],
    submission_reference:ids[2],site_reference:ids[3],
    form_reference:ids[4],destination_reference:ids[5]
  };
  return {
    privateDraft:{
      name:'Pessoa de demonstração',role:'',email:'proof@example.invalid',
      phone:'',mobile:'',serviceSlug:'onepage',
      details:'Cenário completamente fictício de orçamento.',
      challengePreview:'5',previewUnderstanding:true
    },
    envelope,storedSnapshot:{original:envelope,phase:'open',version:0},
    expectedVersion:0
  };
};
test('P0-F177 server refuses structural CRM review without a signed one-time proof',async()=>{
  const lab=await startPrivateBudgetReviewLab(password,{requireRequestProof:true});
  const url=new URL(lab.url);
  const auth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
  const issue=()=>fetch(url.origin+'/__lab/budget/request-proof',{
    headers:{Authorization:auth}
  });
  const post=(body,headers={})=>fetch(lab.url,{
    method:'POST',headers:{Authorization:auth,Origin:url.origin,
      'Content-Type':'application/json',...headers},
    body:JSON.stringify(body),redirect:'manual'
  });
  try{
    assert.equal((await issue()).status,200);
    const unauthorized=await fetch(url.origin+'/__lab/budget/request-proof');
    assert.equal(unauthorized.status,401);
    const missing=await post(sample());
    assert.equal(missing.status,422);
    assert.equal((await missing.json()).code,'PROOF_GATED_BODY_SHAPE_REQUIRED');
    const proof=await (await issue()).json();
    assert.match(proof.requestProof,/^v1\./);
    assert.equal(proof.ttlSeconds,120);
    assert.equal(proof.canSendToCrm,false);
    const first=await post({...sample(),requestProof:proof.requestProof});
    assert.equal(first.status,200);
    assert.equal(first.headers.get('set-cookie'),null);
    assert.equal(first.headers.get('cache-control'),'private, no-store');
    const result=await first.json();
    assert.equal(result.mode,'LAB_DIAGNOSTIC_NOT_RECEIPT');
    assert.equal(result.reasonCode,'ATOMIC_STORE_REQUIRED');
    for(const key of ['canSendToCrm','canAcknowledgeVisitor','canDeploy'])
      assert.equal(result[key],false);
    const again=await post({...sample(),requestProof:proof.requestProof});
    assert.equal(again.status,409);
    assert.equal((await again.json()).code,'SIGNED_REQUEST_PROOF_REQUIRED_OR_USED');
    for(const field of [proof.requestProof,password,'proof@example.invalid',ids[0]])
      assert.equal(JSON.stringify(result).includes(field),false);
    const badProof=await post({...sample(),requestProof:proof.requestProof+'A'});
    assert.equal(badProof.status,409);
    const body=sample();body.privateDraft.email='not-an-email';
    const fresh=await (await issue()).json();
    const invalid=await post({...body,requestProof:fresh.requestProof});
    assert.equal(invalid.status,200);
    assert.equal((await invalid.json()).reasonCode,'INVALID_CONTACT_ROUTE');
  }finally{await lab.close();}
});
test('P0-F177 simultaneous posts cannot reuse one proof or create a CRM receipt',async()=>{
  const lab=await startPrivateBudgetReviewLab(password,{requireRequestProof:true});
  const url=new URL(lab.url);
  const auth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
  try{
    const proof=await (await fetch(url.origin+'/__lab/budget/request-proof',{
      headers:{Authorization:auth}
    })).json();
    const replies=await Promise.all(Array.from({length:12},()=>fetch(lab.url,{
      method:'POST',redirect:'manual',
      headers:{Authorization:auth,Origin:url.origin,'Content-Type':'application/json'},
      body:JSON.stringify({...sample(),requestProof:proof.requestProof})
    })));
    assert.deepEqual(replies.map(r=>r.status).sort(),[200,...Array(11).fill(409)]);
    const json=await Promise.all(replies.map(r=>r.json()));
    assert.equal(json.filter(x=>x.reasonCode==='ATOMIC_STORE_REQUIRED').length,1);
    assert.ok(json.every(x=>x.canAcknowledgeVisitor===false));
  }finally{await lab.close();}
});
test('P0-F177 wrong origin, malformed body and forged contact field cannot bypass proof',async()=>{
  const lab=await startPrivateBudgetReviewLab(password,{requireRequestProof:true});
  const url=new URL(lab.url);
  const auth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
  try{
    const proof=await (await fetch(url.origin+'/__lab/budget/request-proof',{
      headers:{Authorization:auth}
    })).json();
    const base={...sample(),requestProof:proof.requestProof};
    const send=(body,headers={})=>fetch(lab.url,{
      method:'POST',
      headers:{Authorization:auth,Origin:url.origin,
        'Content-Type':'application/json',...headers},
      body:JSON.stringify(body)
    });
    assert.equal((await send(base,{Origin:'https://attacker.invalid'})).status,403);
    assert.equal((await send({...base,extra:'customer-value'})).status,422);
    assert.equal((await send({...base,requestProof:123})).status,409);
    const valid=await send(base);
    assert.equal(valid.status,200,
      'F177 malformed/cross-origin requests must not consume a valid proof');
    assert.equal((await fetch(url.origin+'/__lab/budget/request-proof',{
      method:'POST',headers:{Authorization:auth,Origin:url.origin,
        'Content-Type':'application/json'},body:'{}'
    })).status,404);
    assert.equal((await fetch(lab.url,{
      method:'GET',headers:{Authorization:auth}
    })).status,405);
  }finally{await lab.close();}
});

test('P0-F181 cross-site proof issuance is denied before issuance quota is consumed',async()=>{
  const lab=await startPrivateBudgetReviewLab(password,{requireRequestProof:true});
  const url=new URL(lab.url);
  const endpoint=url.origin+'/__lab/budget/request-proof';
  const auth='Basic '+Buffer.from('reviewer:'+password).toString('base64');
  try{
    const request=(headers={})=>fetch(endpoint,{redirect:'manual',headers:{
      Authorization:auth,...headers
    }});
    for(const headers of [
      {Origin:'https://attacker.invalid'},
      {Origin:'null'},
      {'Sec-Fetch-Site':'cross-site'},
      {'Sec-Fetch-Site':'same-site'},
      {Origin:url.origin,'Sec-Fetch-Site':'cross-site'}
    ]){
      const denied=await request(headers);
      assert.equal(denied.status,403);
      assert.equal((await denied.json()).code,'PROOF_ISSUANCE_ORIGIN_DENIED');
    }
    const allowed=await request({Origin:url.origin,'Sec-Fetch-Site':'same-origin'});
    assert.equal(allowed.status,200);
    assert.match((await allowed.json()).requestProof,/^v1\./);
    const cli=await request({'Sec-Fetch-Site':'none'});
    assert.equal(cli.status,200);
    assert.equal(cli.headers.get('set-cookie'),null);
    assert.equal(cli.headers.get('cache-control'),'private, no-store');
  }finally{await lab.close();}
});

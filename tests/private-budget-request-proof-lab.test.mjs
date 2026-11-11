import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {issuePrivateBudgetRequestProofLab as issue,
  inspectPrivateBudgetRequestProofLab as inspect}
  from '../src/lib/private-budget-request-proof-lab.mjs';

const key=Buffer.alloc(32,0x42);
const origin='http://127.0.0.1:4321';
const scope='synthetic-review-session';
const t=1790000000000;
const entropy=Buffer.from(Array.from({length:18},(_,i)=>i+1));
const build=(overrides={})=>issue({key,origin,scope,nowMs:t,entropy,...overrides});
const verify=(token,overrides={})=>inspect({
  key,token,origin,scope,nowMs:t+100,
  claimNonce:()=>true,...overrides
});

test('P0-F176 valid signed nonce has bounded lifetime and cannot acknowledge a quote',async()=>{
  const a=build();
  assert.match(a.token,/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
  assert.equal(a.ttlSeconds,120);
  const used=new Set();
  const consume=nonce=>used.has(nonce)?false:(used.add(nonce),true);
  const first=await verify(a.token,{claimNonce:consume});
  assert.equal(first.code,'SYNTHETIC_ONE_TIME_PROOF_VALID');
  assert.equal(first.cryptographicStructureChecked,true);
  assert.equal(first.oneTimeNonceClaimedInLab,true);
  for(const field of ['durableReplayPreventionProven','captchaOrBotDefenseVerified',
    'legalConsentVerified','tenantAuthorized','publicIntakeAllowed',
    'canPersist','canAcknowledgeVisitor','canDeploy'])
    assert.equal(first[field],false,field);
  const repeat=await verify(a.token,{claimNonce:consume});
  assert.equal(repeat.code,'NONCE_ALREADY_USED_OR_NOT_DURABLE');
  assert.ok(Object.isFrozen(first));
  for(const secret of [scope,origin,a.token,key.toString('hex')])
    assert.ok(!JSON.stringify(first).includes(secret));
});
test('P0-F176 expired, future, cross-origin or wrong scope are rejected before nonce claim',async()=>{
  const a=build();
  let calls=0;
  const claimNonce=()=>{calls++;return true;};
  for(const overrides of [
    {nowMs:t+120001},{nowMs:t-1},
    {origin:'http://127.0.0.1:5432'},
    {scope:'synthetic-other-session'},
    {key:Buffer.alloc(32,0x43)}
  ]){
    const r=await verify(a.token,{claimNonce,...overrides});
    assert.notEqual(r.code,'SYNTHETIC_ONE_TIME_PROOF_VALID');
    assert.equal(r.canDeploy,false);
  }
  assert.equal(calls,0);
});
test('P0-F176 refuses malformed proof, wrong signatures and fake dynamic payload',async()=>{
  const a=build();
  const [v,p,s]=a.token.split('.');
  const bad=[
    null,undefined,{},42,'',a.token+'?',
    'v2.'+p+'.'+s,'v1.'+p+'.'+s+'x',
    'v1.'+p.slice(0,-1)+'x.'+s,
    'v1.'+p+'.'+Buffer.alloc(32,0).toString('base64url'),
    'v1.'+p+'.'+s+'.extra',
    'A'.repeat(600)
  ];
  for(const token of bad){
    const result=await verify(token);
    assert.notEqual(result.code,'SYNTHETIC_ONE_TIME_PROOF_VALID');
    assert.equal(result.oneTimeNonceClaimedInLab,false);
  }
  const signed=(value)=>{
    const body=Buffer.from(JSON.stringify(value)).toString('base64url');
    const mac=createHmac('sha256',key)
      .update('imagine.private-budget.proof.lab.v1\n'+body).digest('base64url');
    return 'v1.'+body+'.'+mac;
  };
  const payload={version:1,issuedAtMs:t,nonce:entropy.toString('base64url'),
    origin,scope};
  for(const forged of [
    {...payload,extra:'trusted'},
    {...payload,version:2},
    {...payload,nonce:'INVALID'},
    {...payload,issuedAtMs:'1790000000000'},
    {...payload,origin:'https://external.invalid'}
  ])assert.notEqual((await verify(signed(forged))).code,
    'SYNTHETIC_ONE_TIME_PROOF_VALID');
});
test('P0-F176 missing/throwing proof storage refuses replay without exposing a visitor',async()=>{
  const a=build();
  for(const claimNonce of [undefined,null,()=>false,()=>undefined,()=>{
    throw Error('sensitive internal diagnostic must be hidden');
  }]){
    const r=await verify(a.token,{claimNonce});
    assert.equal(r.canAcknowledgeVisitor,false);
    assert.equal(r.canDeploy,false);
    assert.notEqual(r.code,'SYNTHETIC_ONE_TIME_PROOF_VALID');
    assert.ok(!JSON.stringify(r).includes('sensitive internal diagnostic'));
  }
});
test('P0-F176 a race of 50 callbacks cannot accept a duplicate in one process',async()=>{
  const a=build();
  const registry=new Set();
  const results=await Promise.all(Array.from({length:50},()=>verify(a.token,{
    claimNonce:nonce=>{
      if(registry.has(nonce))return false;
      registry.add(nonce);return true;
    }
  })));
  assert.equal(results.filter(r=>r.oneTimeNonceClaimedInLab).length,1);
  assert.equal(results.filter(r=>r.code==='NONCE_ALREADY_USED_OR_NOT_DURABLE').length,49);
});
test('P0-F176 issuer rejects weak secrets, invalid origin and nonrandom entropy types',()=>{
  for(const bad of [{key:Buffer.alloc(8)},{key:'plaintext'},
    {origin:'https://www.imaginecomunicacao.com.br'},
    {origin:'http://127.0.0.1:99999'},
    {scope:'pessoa@example.invalid'},{scope:'../admin'},
    {nowMs:-5},{entropy:'123456789012345678'},
    {entropy:Buffer.alloc(3)}])
    assert.throws(()=>build(bad),/invalid synthetic proof issuer context/);
});

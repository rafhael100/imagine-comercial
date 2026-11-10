import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectSyntheticCrmReconciliationLab as inspect}
  from '../src/lib/crm-reconciliation-parity-lab.mjs';
import {inspectSyntheticCrmReceiptMac}
  from '../src/lib/crm-hmac-receipt-interop-lab.mjs';

const keys=['organization_reference','binding_reference','submission_reference'];
const ids=[
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
];
const identity=()=>Object.fromEntries(keys.map((key,i)=>[key,ids[i]]));
const observation=(route,status)=>({route,identity:identity(),status});
const fixture=(a='unknown',b='unknown',delivered=false,late=false)=>({
  expected:identity(),primary:observation('primary',a),
  contingency:observation('contingency',b),
  crmDeliveredClaimed:delivered,lateCrmReplyClaimed:late
});
function assertFailClosed(res){
  assert.equal(res.mode,'SYNTHETIC_UNVERIFIED_RECEIVER_OBSERVATIONS');
  for(const flag of [
    'canMarkDelivered','canScheduleRetry','canDeleteTemporaryPayload',
    'canAcknowledgeVisitor','tenantAuthorized','crmPersistenceProven',
    'deploymentAuthorized'
  ])assert.equal(res[flag],false,flag);
  assert.ok(Object.isFrozen(res));
  for(const id of ids)assert.ok(!JSON.stringify(res).includes(id));
}

test('F93: all 4×4×2×2 synthetic receiver combinations match PHP precedence',()=>{
  const statuses=['unknown','durable_claimed','failure_claimed','expired_claimed'];
  let scenarios=0;
  for(const a of statuses)for(const b of statuses)
    for(const delivered of [false,true])for(const late of [false,true]){
      const anyExpired=[a,b].includes('expired_claimed');
      const anyDurable=[a,b].includes('durable_claimed');
      const anyFailed=[a,b].includes('failure_claimed');
      const code=
        late&&anyExpired?'LATE_REPLY_EXPIRY_CONFLICT':
        late?'LATE_REPLY_REVIEW_REQUIRED':
        anyExpired&&delivered?'DELIVERY_EXPIRY_CONFLICT':
        anyExpired&&anyDurable?'RECEIVER_EXPIRY_CONFLICT':
        anyExpired?'EXPIRY_RECONCILIATION_REQUIRED':
        delivered?'CRM_PERSISTENCE_PROOF_REQUIRED':
        a==='durable_claimed'&&b==='durable_claimed'?'DUAL_RECEIVER_CLAIMS_REVIEW':
        anyDurable?'DURABLE_CLAIM_UNVERIFIED':
        a==='failure_claimed'&&b==='failure_claimed'?'BOTH_RECEIVERS_FAILED_CLAIMED':
        anyFailed?'RECEIVER_FAILURE_CLAIMED':'NO_VERIFIED_RECEIPT';
      const outcome=inspect(fixture(a,b,delivered,late));
      assert.equal(outcome.reasonCode,code,JSON.stringify({a,b,delivered,late}));
      assertFailClosed(outcome);
      scenarios++;
    }
  assert.equal(scenarios,64);
});

test('F93: forged identities and swapped roles are rejected before receipt claims',()=>{
  for(const key of keys){
    for(const path of ['primary','contingency']){
      const input=fixture('durable_claimed','durable_claimed',true,true);
      input[path].identity[key]='77777777-7777-4777-8777-777777777777';
      assert.equal(inspect(input).reasonCode,'SUBMISSION_IDENTITY_CONFLICT');
      assertFailClosed(inspect(input));
    }
  }
  const swapped=fixture();
  swapped.primary.route='contingency';
  swapped.contingency.route='primary';
  assert.equal(inspect(swapped).reasonCode,'RECEIVER_ROLE_CONFLICT');
});

test('F93: malformed or PII-enriched observation cannot grant a delivered state',()=>{
  for(const input of [
    null,{},[],{...fixture(),email:'person@example.test'},
    {...fixture(),crmDeliveredClaimed:'true'},
    {...fixture(),lateCrmReplyClaimed:null},
    {...fixture(),primary:{...observation('primary','unknown'),message:'sensitive'}},
    {...fixture(),primary:observation('invalid','unknown')},
    {...fixture(),primary:observation('primary','delivered')},
    {...fixture(),expected:{...identity(),email:'person@example.test'}},
    {...fixture(),expected:{...identity(),organization_reference:'nonsense'}},
    {...fixture(),expected:{...identity(),binding_reference:'00000000-0000-0000-0000-000000000000'}}
  ]){
    const outcome=inspect(input);
    assert.equal(outcome.reasonCode,'OBSERVATION_STRUCTURE_INVALID');
    assertFailClosed(outcome);
  }
});

test('F93: UUID case-insensitive logical identity matches PHP model',()=>{
  const input=fixture('unknown','durable_claimed');
  input.primary.identity=Object.fromEntries(keys.map((key,i)=>[key,ids[i].toUpperCase()]));
  input.contingency.identity=Object.fromEntries(keys.map((key,i)=>[key,ids[i].toUpperCase()]));
  assert.equal(inspect(input).reasonCode,'DURABLE_CLAIM_UNVERIFIED');
});

test('F93: even a matching synthetic HMAC plus dual durable claims cannot ACK',()=>{
  const full={
    protocol:'imagine.lead-intake',schema_version:1,
    organization_reference:ids[0],
    binding_reference:ids[1],
    submission_reference:ids[2],
    site_reference:'44444444-4444-4444-8444-444444444444',
    form_reference:'55555555-5555-4555-8555-555555555555',
    destination_reference:'66666666-6666-4666-8666-666666666666'
  };
  const key='fixture-only-no-production-secret-32-bytes-minimum';
  const {createHmac}=await import('node:crypto');
  const issuedAt=1800000000,expiresAt=1800000300;
  const nonce='88888888-8888-4888-8888-888888888888';
  const message=['imagine.lead-intake.synthetic-receipt.v1',
    full.organization_reference,full.binding_reference,full.submission_reference,
    full.site_reference,full.form_reference,full.destination_reference,
    String(issuedAt),String(expiresAt),nonce].join('\n');
  const mac=inspectSyntheticCrmReceiptMac({
    expected:full,reported:full,issuedAt,expiresAt,now:issuedAt+10,nonce,
    signature:createHmac('sha256',key).update(message).digest('hex'),syntheticKey:key
  });
  assert.equal(mac.reasonCode,'LAB_MAC_MATCH_UNTRUSTED');
  assert.equal(mac.canAcknowledgeDurableReceipt,false);
  const claim=inspect(fixture('durable_claimed','durable_claimed',true,true));
  assert.equal(claim.reasonCode,'LATE_REPLY_REVIEW_REQUIRED');
  assertFailClosed(claim);
});

test('F93: no browser import, HTTP, storage or release permission',()=>{
  const lib=readFileSync(new URL('../src/lib/crm-reconciliation-parity-lab.mjs',import.meta.url),'utf8');
  const page=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  assert.match(lib,/Match the precise PHP F3-09 decision precedence/);
  assert.doesNotMatch(lib,/\bfetch\s*\(|XMLHttpRequest|sendBeacon\s*\(|localStorage|process\.env/);
  assert.doesNotMatch(page,/crm-reconciliation-parity-lab|<form\b|<input\b/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {inspectSyntheticCrmReceiptMac as inspect}
  from '../src/lib/crm-hmac-receipt-interop-lab.mjs';

const fields=[
 'organization_reference','binding_reference','submission_reference',
 'site_reference','form_reference','destination_reference'
];
const ids=[
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666'
];
const nonce='88888888-8888-4888-8888-888888888888';
const key='fixture-only-no-production-secret-32-bytes-minimum';
const issuedAt=1800000000;
const expiresAt=1800000300;
const now=issuedAt+60;
const hex='901681315fa95b64cd44b2d9b25ce838db6a74ace18f2beccdf6de02791d0358';
const envelope=()=>({
  protocol:'imagine.lead-intake',schema_version:1,
  ...Object.fromEntries(fields.map((f,i)=>[f,ids[i]]))
});
const fixture=()=>({
  expected:envelope(),reported:envelope(),issuedAt,expiresAt,now,
  nonce,signature:hex,syntheticKey:key
});

function assertNoAuthority(result){
  for(const flag of [
    'canAcceptLead','canAcknowledgeDurableReceipt','canDeliverToCrm',
    'canTreatAsReplaySafe','tenantAuthorized','productionAuthorized'
  ])assert.equal(result[flag],false,flag);
  const output=JSON.stringify(result);
  for(const privateValue of [...ids,nonce,key,hex])assert.equal(output.includes(privateValue),false);
  assert.ok(Object.isFrozen(result));
}

test('F90: stable Node vector matches PHP F3-15 canonical HMAC-SHA256 bytes',()=>{
  const message=[
    'imagine.lead-intake.synthetic-receipt.v1',...ids,
    String(issuedAt),String(expiresAt),nonce
  ].join('\n');
  assert.equal(createHmac('sha256',key).update(message,'utf8').digest('hex'),hex);
  const result=inspect(fixture());
  assert.equal(result.reasonCode,'LAB_MAC_MATCH_UNTRUSTED');
  assert.equal(result.macMatchesFixture,true);
  assertNoAuthority(result);
  assert.equal(inspect(fixture()).reasonCode,'LAB_MAC_MATCH_UNTRUSTED',
    'MAC alone cannot prevent replay of exactly the same receipt');
});

test('F90: all pinned organization, binding, submission, site, form and destination mutations fail',()=>{
  for(const field of fields){
    const input=fixture();
    input.reported[field]='77777777-7777-4777-8777-777777777777';
    const result=inspect(input);
    assert.equal(result.reasonCode,'PINNED_CONTEXT_MISMATCH',field);
    assertNoAuthority(result);
  }
  const uppercase=fixture();
  for(const field of fields)uppercase.reported[field]=uppercase.reported[field].toUpperCase();
  assert.equal(inspect(uppercase).reasonCode,'LAB_MAC_MATCH_UNTRUSTED',
    'PHP LeadSubmissionIdentity lowercases UUIDs before signing');
});

test('F90: wrong key, tampered nonce and corrupted MAC are rejected',()=>{
  const wrongKey=inspect({...fixture(),syntheticKey:'x'.repeat(40)});
  assert.equal(wrongKey.reasonCode,'MAC_MISMATCH');
  const wrongNonce=inspect({...fixture(),nonce:'99999999-9999-4999-8999-999999999999'});
  assert.equal(wrongNonce.reasonCode,'MAC_MISMATCH');
  const wrongSignature=inspect({...fixture(),signature:'a'.repeat(64)});
  assert.equal(wrongSignature.reasonCode,'MAC_MISMATCH');
  for(const result of [wrongKey,wrongNonce,wrongSignature])assertNoAuthority(result);
});

test('F90: negative time windows preserve PHP inspector precedence',()=>{
  const invalid=[
    [issuedAt,expiresAt,expiresAt],
    [issuedAt,expiresAt,expiresAt+1],
    [issuedAt+90,expiresAt,issuedAt],
    [-1,expiresAt,issuedAt],
    [issuedAt,issuedAt,issuedAt],
    [issuedAt,issuedAt+301,issuedAt+1],
    [issuedAt,expiresAt,0],
    [issuedAt,expiresAt,'1800000060']
  ];
  for(const [i,e,n] of invalid){
    const result=inspect({...fixture(),issuedAt:i,expiresAt:e,now:n});
    assert.equal(result.reasonCode,'TIME_WINDOW_INVALID');
    assertNoAuthority(result);
  }
  const future={...fixture(),issuedAt:issuedAt+30,expiresAt:expiresAt+30,now:issuedAt};
  const message=[
    'imagine.lead-intake.synthetic-receipt.v1',...ids,
    String(future.issuedAt),String(future.expiresAt),nonce
  ].join('\n');
  future.signature=createHmac('sha256',key).update(message).digest('hex');
  assert.equal(inspect(future).reasonCode,'LAB_MAC_MATCH_UNTRUSTED');
});

test('F90: untrusted nonce, signatures and secret never become a release proof',()=>{
  for(const candidate of ['NOT-UUID','00000000-0000-0000-0000-000000000000',null,0,
                           'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'.toUpperCase()]){
    const result=inspect({...fixture(),nonce:candidate});
    assert.equal(result.reasonCode,'NONCE_FORMAT_INVALID');
    assertNoAuthority(result);
  }
  for(const candidate of ['bad',hex.toUpperCase(),null,'']){
    assert.equal(inspect({...fixture(),signature:candidate}).reasonCode,
      'CRYPTO_INPUT_INVALID');
  }
  for(const candidate of ['',null,'weak',123]){
    assert.equal(inspect({...fixture(),syntheticKey:candidate}).reasonCode,
      'CRYPTO_INPUT_INVALID');
  }
  for(const candidate of [null,undefined,[],{},
                         {...fixture(),customer:'must not escape'},
                         {...fixture(),signature:undefined}]){
    assert.equal(inspect(candidate).reasonCode,'CRYPTO_INPUT_INVALID');
  }
  for(const candidate of [
    {...fixture(),reported:{...envelope(),contactEmail:'x@example.test'}},
    {...fixture(),expected:{...envelope(),protocol:'wrong'}}
  ])assert.equal(inspect(candidate).reasonCode,'PINNED_CONTEXT_MISMATCH');
});

test('F90: inspector remains private/offline, does not report IDs or bind into Astro',()=>{
  const source=readFileSync(new URL('../src/lib/crm-hmac-receipt-interop-lab.mjs',import.meta.url),'utf8');
  const contact=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  assert.match(source,/timingSafeEqual/);
  assert.match(source,/LAB_ONLY_UNTRUSTED_KEY_NO_PERSISTENCE/);
  assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|sendBeacon\s*\(|https?:\/\//);
  assert.doesNotMatch(contact,/crm-hmac-receipt-interop-lab|<form\b|fetch\s*\(/i);
});

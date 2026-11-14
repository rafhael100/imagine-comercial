import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticCalculatorIntent, inspectSyntheticCalculatorIntent,
  calculatorIntentSigningBytes} from '../src/lib/synthetic-calculator-interest-interop-lab.mjs';

// Public constant is an intentionally disposable fixture, NOT a secret.
const key='IMAGINE_CALCULATOR_CI_ONLY_KEY_2026_NOT_FOR_PRODUCTION_ABC123';
const signature='44f3c4d8c6f49830caf6c66a9c295ffa207e67801b3c7c7cabb337518dde7816';
const payload={
  schema:'imagine.calculator.synthetic-interest.v1',
  source:'imagine_comercial_calculadora_performance',
  submission_id:'123e4567-e89b-42d3-a456-426614174000',
  channel_ids:['chatgpt_ads','google_ads','meta_ads'],
  currency:'BRL',
  media_total_cents:430000,
  report_requested:true,
  marketing_requested:false,
  notice_version:'lab-notice-v1',
  issued_at:1794672000,
  expires_at:1794672300,
  nonce:'f2e67d4e-39c1-43ba-a304-7db5477a2e66'
};
const now=1794672030;
test('Node synthetic HMAC matches independent PHP reference vector; no CRM authority',()=>{
  const p=createSyntheticCalculatorIntent(payload,key);
  assert.equal(p.signature,signature);
  assert.equal(calculatorIntentSigningBytes(payload).split('\n').length,13);
  const result=inspectSyntheticCalculatorIntent(p,key,now);
  assert.equal(result.state,'SYNTHETIC_MAC_MATCH_UNTRUSTED');
  assert.equal(result.synthetic_mac_matches,true);
  for(const k of ['tenant_authorized','consent_proven','crm_durable_receipt_proven',
    'can_send_report','can_send_marketing','can_store_lead'])
    assert.equal(result[k],false,k+' is always denied in lab');
  assert.equal(Object.hasOwn(result,'email'),false);
});
test('HMAC binds budget, consent claims and channel scopes but proves no opt-in',()=>{
  const signed=createSyntheticCalculatorIntent(payload,key);
  const mut=(o)=>inspectSyntheticCalculatorIntent({...signed,payload:{...payload,...o}},key,now);
  for(const value of [
    {media_total_cents:430001},{marketing_requested:true},
    {channel_ids:['chatgpt_ads','meta_ads']},
    {submission_id:'123e4567-e89b-42d3-a456-426614174001'},
    {notice_version:'lab-notice-v2'}
  ])assert.equal(mut(value).synthetic_mac_matches,false);
  const opted=createSyntheticCalculatorIntent({...payload,marketing_requested:true},key);
  const status=inspectSyntheticCalculatorIntent(opted,key,now);
  assert.equal(status.synthetic_mac_matches,true);
  assert.equal(status.consent_proven,false);
  assert.equal(status.can_send_marketing,false);
});
test('replays, invalid keys, malicious schemas and noncanonical channel order are denied',()=>{
  const signed=createSyntheticCalculatorIntent(payload,key);
  assert.equal(inspectSyntheticCalculatorIntent(signed,key,1794672400).synthetic_mac_matches,false);
  assert.equal(inspectSyntheticCalculatorIntent(signed,'bad',now).synthetic_mac_matches,false);
  assert.equal(inspectSyntheticCalculatorIntent({...signed,signature:'a'.repeat(64)},key,now).synthetic_mac_matches,false);
  assert.equal(inspectSyntheticCalculatorIntent({...signed,source:'tenant_other'},key,now).synthetic_mac_matches,false);
  for(const bad of [
    {channel_ids:['meta_ads','google_ads']},
    {channel_ids:['meta_ads','meta_ads']},
    {channel_ids:['fake_ads']},
    {currency:'USD'},{media_total_cents:-1},{media_total_cents:'430000'},
    {report_requested:false,marketing_requested:false},
    {report_requested:'true'},{nonce:payload.submission_id},
    {issued_at:1794672000,expires_at:1794672601},
    {email:'fake@example.test'},
  ])assert.throws(()=>createSyntheticCalculatorIntent({...payload,...bad},key));
  const exotic=Object.defineProperty({...payload},'secret',{get(){throw Error('not touched')},enumerable:false});
  assert.throws(()=>createSyntheticCalculatorIntent(exotic,key));
});

test('synthetic producer never executes getter injected into channel array',()=>{
  const channels=[...payload.channel_ids];
  let getterCalled=false;
  Object.defineProperty(channels,'0',{enumerable:true,configurable:true,
    get(){getterCalled=true;throw Error('malicious accessor executed')}});
  assert.throws(()=>createSyntheticCalculatorIntent({...payload,channel_ids:channels},key),
    /Invalid calculator intent/);
  assert.equal(getterCalled,false,'untrusted array getter must not run');
  const hole=[...payload.channel_ids];delete hole[0];
  assert.throws(()=>createSyntheticCalculatorIntent({...payload,channel_ids:hole},key));
});

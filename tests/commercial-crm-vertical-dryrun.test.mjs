import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewSyntheticCommercialCrmPath as review}
  from '../src/lib/commercial-crm-vertical-dryrun.mjs';

const uuid=n=>'bde4f010-aacf-4ad7-a302-94c507bb'+String(n).padStart(4,'0');
const draft=()=>({
  name:'Cliente Fictício',email:'cliente@example.test',phone:'',
  serviceSlug:'landing-pages',
  details:'Pretendo construir uma página de testes, sem dados reais.',
  consent:true,honeypot:''
});
const envelope=()=>({
  protocol:'imagine.lead-intake',schema_version:1,
  organization_reference:uuid(1),binding_reference:uuid(2),
  submission_reference:uuid(3),site_reference:uuid(4),
  form_reference:uuid(5),destination_reference:uuid(6)
});
const fixture=()=>({
  draft:draft(),envelope:envelope(),
  storedSnapshot:{original:envelope(),phase:'open',version:0},
  expectedVersion:0
});

function assertNoAuthorization(result){
  for(const key of [
    'consentProven','tenantBindingVerified','durableReservationProven',
    'crmDeliveryProven','canSubmit','canAcknowledge','deploymentAuthorized'
  ])assert.equal(result[key],false,key);
  assert.ok(Object.isFrozen(result));
  const text=JSON.stringify(result);
  for(const pii of ['Cliente Fictício','cliente@example.test','Pretendo construir','+5511999999999']){
    assert.equal(text.includes(pii),false);
  }
}

test('F81: nominal synthetic journey ends at atomic-store blocker, NOT at delivery',()=>{
  const res=review(fixture());
  assert.equal(res.mode,'OFFLINE_STRUCTURAL_REVIEW_ONLY');
  assert.equal(res.stage,'crm-idempotency');
  assert.equal(res.reasonCode,'ATOMIC_STORE_REQUIRED');
  assertNoAuthorization(res);
});

test('F81: invalid, missing or falsely assumed contact consent stops before CRM',()=>{
  for(const d of [
    {...draft(),consent:false},
    {...draft(),email:'invalid'},
    {...draft(),honeypot:'robot'},
    {...draft(),serviceSlug:'fabricated-service'},
    {...draft(),customerCpf:'not-a-required-field'}
  ]){
    const result=review({...fixture(),draft:d});
    assert.equal(result.stage,'commercial-draft');
    assert.equal(result.reasonCode,'F30_DRAFT_REJECTED');
    assertNoAuthorization(result);
  }
});

test('F81: structural envelope is necessary but never proof of authentication',()=>{
  const invalid={...fixture(),envelope:{...envelope(),protocol:'other'}};
  assert.equal(review(invalid).reasonCode,'PROTOCOL_UNSUPPORTED');
  assert.equal(review(invalid).stage,'crm-envelope');
  const extra={...fixture(),envelope:{...envelope(),tracking:'sensitive-data'}};
  assert.equal(review(extra).reasonCode,'ENVELOPE_STRUCTURE_INVALID');
  assertNoAuthorization(review(extra));
});

test('F81: cross-organization, re-routed and uncertain deliveries remain blocked',()=>{
  const changedTenant=fixture();
  changedTenant.envelope.organization_reference=uuid(9);
  assert.equal(review(changedTenant).reasonCode,'LOGICAL_SCOPE_MISMATCH');
  const changedDest=fixture();
  changedDest.envelope.destination_reference=uuid(9);
  assert.equal(review(changedDest).reasonCode,'PINNED_CONTEXT_CONFLICT');
  const uncertain=fixture();
  uncertain.storedSnapshot.phase='outcome_unknown';
  assert.equal(review(uncertain).reasonCode,'UNKNOWN_OUTCOME_LOOKUP_REQUIRED');
  const stale=fixture();
  stale.expectedVersion=2;
  assert.equal(review(stale).reasonCode,'STALE_SNAPSHOT_RECONCILE');
  const malformed=fixture();
  malformed.storedSnapshot={phase:'open',version:0};
  assert.equal(review(malformed).reasonCode,'F80_SNAPSHOT_REJECTED');
  for(const x of [changedTenant,changedDest,uncertain,stale,malformed]){
    assertNoAuthorization(review(x));
  }
});

test('F81: reviewer cannot accidentally expose this dry-run on the public site',()=>{
  const contact=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  const module=readFileSync(new URL('../src/lib/commercial-crm-vertical-dryrun.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(contact,/commercial-crm-vertical-dryrun|<form\b|fetch\s*\(/i);
  assert.doesNotMatch(module,/\bfetch\s*\(|XMLHttpRequest|sendBeacon\s*\(|process\.env|localStorage/);
  assert.match(module,/No form, API, storage, receipt/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPrivateBudgetToCrmLab} from '../src/lib/private-budget-crm-review.mjs';

const references=[
  'bde4f010-aacf-4ad7-a302-94c507bb1111',
  'bde4f010-aacf-4ad7-a302-94c507bb2222',
  'bde4f010-aacf-4ad7-a302-94c507bb3333',
  'bde4f010-aacf-4ad7-a302-94c507bb4444',
  'bde4f010-aacf-4ad7-a302-94c507bb5555',
  'bde4f010-aacf-4ad7-a302-94c507bb6666'
];
const draft=()=>({
  name:'Visitante de Laboratório',role:'',email:'laboratorio@example.invalid',
  phone:'',mobile:'',serviceSlug:'landing-pages',
  details:'Pedido inteiramente fictício para contrato em teste.',
  challengePreview:'5',previewUnderstanding:true
});
const envelope=()=>({
  protocol:'imagine.lead-intake',schema_version:1,
  organization_reference:references[0],binding_reference:references[1],
  submission_reference:references[2],site_reference:references[3],
  form_reference:references[4],destination_reference:references[5]
});
const request=()=>({
  privateDraft:draft(),envelope:envelope(),
  storedSnapshot:{original:envelope(),phase:'open',version:0},
  expectedVersion:0
});
function assertNeverAuthorized(r){
  for(const k of ['browserTenantClaimsTrusted','legalConsentVerified','antiBotVerified',
    'serverServiceIdentityVerified','durableReservationVerified','realCrmAcknowledgementVerified',
    'canCreateContact','canCreateCrmLead','canAutoRetry','canAcknowledgeVisitor',
    'canReplaceLegacyContactForm','canDeploy'])assert.equal(r[k],false,k);
  assert.ok(Object.isFrozen(r));
  for(const value of ['Visitante de Laboratório','laboratorio@example.invalid',
    'Pedido inteiramente fictício',...references])
    assert.equal(JSON.stringify(r).includes(value),false,'PII or technical reference escaped');
}
test('P0 F159: real code composition reaches CRM CAS precondition with no effects',()=>{
  const r=reviewPrivateBudgetToCrmLab(request());
  assert.equal(r.stage,'crm-idempotency');
  assert.equal(r.reasonCode,'ATOMIC_STORE_REQUIRED');
  assertNeverAuthorized(r);
});
test('P0 F159: stale state and claimed delivery cannot authorize retry',()=>{
  for(const [phase,version,expected,reason] of [
    ['open',2,1,'STALE_SNAPSHOT_RECONCILE'],
    ['outcome_unknown',0,0,'UNKNOWN_OUTCOME_LOOKUP_REQUIRED'],
    ['delivered_claimed',0,0,'DELIVERED_CLAIM_REVIEW'],
    ['reserved',0,0,'IN_FLIGHT_REVIEW']
  ]){
    const q=request();
    q.storedSnapshot={original:envelope(),phase,version};
    q.expectedVersion=expected;
    const r=reviewPrivateBudgetToCrmLab(q);
    assert.equal(r.reasonCode,reason);
    assertNeverAuthorized(r);
  }
});
test('P0 F159: preview tampering, claims and unknown service fail before CRM',()=>{
  for(const [change,stage] of [
    [{email:'bad'},'private-budget'],[{serviceSlug:'evil'},'private-budget'],
    [{previewUnderstanding:false},'private-budget']
  ]){
    const q=request();q.privateDraft={...q.privateDraft,...change};
    const r=reviewPrivateBudgetToCrmLab(q);
    assert.equal(r.stage,stage);
    assertNeverAuthorized(r);
  }
  const q=request();q.privateDraft={...q.privateDraft,consentVerified:true};
  assert.equal(reviewPrivateBudgetToCrmLab(q).reasonCode,'INVALID_SHAPE');
});
test('P0 F159: envelope cannot contain customer fields or be a tenant assertion',()=>{
  for(const altered of [
    {...envelope(),name:'Visitante de Laboratório'},
    {...envelope(),organization_reference:'invalid'},
    {...envelope(),protocol:'fake'}
  ]){
    const q=request();q.envelope=altered;
    const r=reviewPrivateBudgetToCrmLab(q);
    assert.equal(r.stage,'crm-envelope');
    assertNeverAuthorized(r);
  }
  const q=request();
  q.storedSnapshot={...q.storedSnapshot,original:{
    ...envelope(),destination_reference:'bde4f010-aacf-4ad7-a302-94c507bb9999'
  }};
  const r=reviewPrivateBudgetToCrmLab(q);
  assert.equal(r.reasonCode,'PINNED_CONTEXT_CONFLICT');
  assertNeverAuthorized(r);
});
test('P0 F159: malformed and absent snapshots produce closed diagnoses',()=>{
  for(const storedSnapshot of [null,{},[],{original:envelope(),phase:'made_up',version:0}]){
    const q=request();q.storedSnapshot=storedSnapshot;
    const r=reviewPrivateBudgetToCrmLab(q);
    assert.equal(r.reasonCode,'F80_SNAPSHOT_REJECTED');
    assertNeverAuthorized(r);
  }
});

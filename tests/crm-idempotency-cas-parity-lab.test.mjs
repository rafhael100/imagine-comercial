import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectSyntheticCrmCasPrecondition as inspect}
  from '../src/lib/crm-idempotency-cas-parity-lab.mjs';

const uuid=n=>'bde4f010-aacf-4ad7-a302-94c507bb'+String(n).padStart(4,'0');
const original=()=>({
  protocol:'imagine.lead-intake',
  schema_version:1,
  organization_reference:uuid(1),
  binding_reference:uuid(2),
  submission_reference:uuid(3),
  site_reference:uuid(4),
  form_reference:uuid(5),
  destination_reference:uuid(6)
});
const snapshot=(phase='open',version=3)=>({original:original(),phase,version});
const args=(phase='open',version=3)=>({
  stored:snapshot(phase,version),incoming:original(),expectedVersion:version
});

test('F80: matching open claim proposes only a version, never commits or delivers',()=>{
  const r=inspect(args());
  assert.equal(r.reasonCode,'ATOMIC_STORE_REQUIRED');
  assert.equal(r.proposedNextVersion,4);
  assert.equal(r.canCommitReservation,false);
  assert.equal(r.canRetryDelivery,false);
  assert.equal(r.canCreateLead,false);
  assert.ok(Object.isFrozen(r));
  for(const value of Object.values(original()).filter(x=>typeof x==='string'&&x.includes('-')))
    assert.equal(JSON.stringify(r).includes(value),false);
  assert.equal(inspect(args()).reasonCode,'ATOMIC_STORE_REQUIRED',
    'two independent checks can both propose; no atomic store exists');
});

test('F80: logical scope = organization + submission, even if binding changes',()=>{
  for(const key of ['organization_reference','submission_reference']){
    const a=args();
    a.incoming[key]=uuid(9);
    assert.equal(inspect(a).reasonCode,'LOGICAL_SCOPE_MISMATCH',key);
  }
  for(const key of ['binding_reference','site_reference','form_reference','destination_reference']){
    const a=args();
    a.incoming[key]=uuid(9);
    assert.equal(inspect(a).reasonCode,'PINNED_CONTEXT_CONFLICT',key);
    assert.equal(inspect(a).proposedNextVersion,null,key);
  }
  const uppercase=args();
  uppercase.incoming.organization_reference=uppercase.incoming.organization_reference.toUpperCase();
  assert.equal(inspect(uppercase).reasonCode,'ATOMIC_STORE_REQUIRED',
    'UUID lexical case must not fork the logical ledger scope');
});

test('F80: version, operation and phases keep recovery fail-closed',()=>{
  for(const expectedVersion of [-1,'3',null,3.5,NaN]){
    assert.equal(inspect({...args(),expectedVersion}).reasonCode,'VERSION_INVALID');
  }
  assert.equal(inspect({...args(),expectedVersion:2}).reasonCode,
    'STALE_SNAPSHOT_RECONCILE');
  assert.equal(inspect({...args(),operation:'retry'}).reasonCode,
    'OPERATION_NOT_SUPPORTED');
  for(const [phase,code] of [
    ['reserved','IN_FLIGHT_REVIEW'],
    ['outcome_unknown','UNKNOWN_OUTCOME_LOOKUP_REQUIRED'],
    ['delivered_claimed','DELIVERED_CLAIM_REVIEW'],
    ['expired_claimed','EXPIRED_CLAIM_REVIEW']
  ]){
    assert.equal(inspect(args(phase)).reasonCode,code,phase);
  }
  assert.equal(inspect(args('open',Number.MAX_SAFE_INTEGER)).reasonCode,'VERSION_OVERFLOW');
});

test('F80: invalid snapshots or unverified metadata never pass the precondition',()=>{
  for(const stored of [
    null,{},[],
    {...snapshot(),phase:'authorized'},
    {...snapshot(),version:-1},
    {...snapshot(),version:2.4},
    {...snapshot(),token:'secret'},
    {...snapshot(),original:{...original(),source_email:'lead@example.test'}},
    {...snapshot(),original:{...original(),destination_reference:'nonsense'}}
  ])assert.throws(()=>inspect({...args(),stored}),/invalid untrusted synthetic/);
  assert.throws(()=>inspect({...args(),incoming:{...original(),protocol:'wrong'}}),
    /invalid untrusted synthetic/);
});

test('F80: public Astro remains disconnected from the CAS simulator',()=>{
  const source=readFileSync(new URL('../src/lib/crm-idempotency-cas-parity-lab.mjs',import.meta.url),'utf8');
  const contact=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  assert.match(source,/NO atomic operation, durable reservation/);
  assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|sendBeacon\s*\(|process\.env|localStorage/);
  assert.doesNotMatch(contact,/crm-idempotency-cas-parity-lab|<form\b|<input\b/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CRM_ENVELOPE_V1_KEYS,inspectSyntheticCrmEnvelopeV1}
  from '../src/lib/crm-envelope-v1-compat-lab.mjs';

const ids=[
  'bde4f010-aacf-4ad7-a302-94c507bb1111',
  'bde4f010-aacf-4ad7-a302-94c507bb2222',
  'bde4f010-aacf-4ad7-a302-94c507bb3333',
  'bde4f010-aacf-4ad7-a302-94c507bb4444',
  'bde4f010-aacf-4ad7-a302-94c507bb5555',
  'bde4f010-aacf-4ad7-a302-94c507bb6666'
];
const envelope=()=>Object.fromEntries(CRM_ENVELOPE_V1_KEYS.map((key,i)=>[
  key,i===0?'imagine.lead-intake':i===1?1:ids[i-2]
]));

test('F78: exact CRM F3-11 eight-key envelope is only structurally compatible',()=>{
  assert.deepEqual(CRM_ENVELOPE_V1_KEYS,[
    'protocol','schema_version','organization_reference','binding_reference',
    'submission_reference','site_reference','form_reference','destination_reference'
  ]);
  const result=inspectSyntheticCrmEnvelopeV1(envelope());
  assert.equal(result.reasonCode,'STRUCTURE_ONLY_UNVERIFIED');
  assert.equal(result.isStructurallyCompatible,true);
  assert.equal(result.canAcceptSubmission,false);
  assert.equal(result.canAcknowledgeDurableReceipt,false);
  assert.equal(result.canDeliverToCrm,false);
  assert.ok(Object.isFrozen(result));
  for(const id of ids)assert.equal(JSON.stringify(result).includes(id),false);
});

test('F78: strict field membership fails closed for payload or consent extras',()=>{
  for(const extra of ['name','email','phone','consent','signature','timestamp','tenantId']){
    assert.equal(inspectSyntheticCrmEnvelopeV1({...envelope(),[extra]:'forged'})
      .reasonCode,'ENVELOPE_STRUCTURE_INVALID');
  }
  const missing=envelope();delete missing.destination_reference;
  assert.equal(inspectSyntheticCrmEnvelopeV1(missing).reasonCode,'ENVELOPE_STRUCTURE_INVALID');
  for(const candidate of [[],null,'bad',Object.create(null),new Date()]){
    assert.equal(inspectSyntheticCrmEnvelopeV1(candidate).reasonCode,
      'ENVELOPE_STRUCTURE_INVALID');
  }
});

test('F78: protocol, version and UUID syntax follow CRM proposal',()=>{
  assert.equal(inspectSyntheticCrmEnvelopeV1({...envelope(),protocol:'imagine.portal'})
    .reasonCode,'PROTOCOL_UNSUPPORTED');
  for(const value of [0,2,'1',null,true]){
    assert.equal(inspectSyntheticCrmEnvelopeV1({...envelope(),schema_version:value})
      .reasonCode,'VERSION_UNSUPPORTED');
  }
  for(const key of CRM_ENVELOPE_V1_KEYS.slice(2)){
    for(const bad of ['abc','00000000-0000-0000-0000-000000000000',null,123]){
      assert.equal(inspectSyntheticCrmEnvelopeV1({...envelope(),[key]:bad})
        .reasonCode,'REFERENCE_FORMAT_INVALID');
    }
  }
  assert.equal(inspectSyntheticCrmEnvelopeV1({
    ...envelope(),site_reference:ids[3].toUpperCase()
  }).reasonCode,'STRUCTURE_ONLY_UNVERIFIED');
});

test('F78: no real CRM acceptance, receipt or delivery can be asserted by this tool',()=>{
  const result=inspectSyntheticCrmEnvelopeV1(envelope());
  assert.deepEqual(Object.keys(result).sort(),[
    'canAcceptSubmission','canAcknowledgeDurableReceipt','canDeliverToCrm',
    'isStructurallyCompatible','reasonCode'
  ]);
  const module=readFileSync(new URL('../src/lib/crm-envelope-v1-compat-lab.mjs',import.meta.url),'utf8');
  const contact=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  assert.doesNotMatch(module,/\bfetch\s*\(|XMLHttpRequest|sendBeacon\s*\(|process\.env|localStorage/);
  assert.doesNotMatch(contact,/crm-envelope-v1-compat-lab|<form\b|fetch\s*\(/i);
});

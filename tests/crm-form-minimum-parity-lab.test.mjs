import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectSyntheticImagineSiteFormMinimum as inspect}
  from '../src/lib/crm-form-minimum-parity-lab.mjs';
import {validateSyntheticLeadDraft} from '../src/lib/lead-intake-lab.mjs';

const draft=(name='Cliente Laboratório',email='cliente@example.test',phone=null)=>({name,email,phone});

test('F79: name and either plausible contact pass structure only; never authorize delivery',()=>{
  const scenarios=[
    [draft('Teste', 'cliente@example.test',null),true,true,false],
    [draft('Teste',null,'+5511999999999'),true,false,true],
    [draft('Teste','cliente@example.test','+55 (11) 99999-9999'),true,true,true],
    [draft(null,'cliente@example.test',null),false,true,false],
    [draft('Teste',null,null),false,false,false],
    [draft('Teste',null,'12345678'),true,false,true]
  ];
  for(const [input,meets,email,phone] of scenarios){
    const res=inspect(input);
    assert.equal(res.meetsStructuralMinimum,meets);
    assert.equal(res.emailCandidateValid,email);
    assert.equal(res.phoneCandidateValid,phone);
    assert.equal(res.canDeliver,false);
    assert.equal(res.canStore,false);
    assert.equal(res.canAcknowledgeReceipt,false);
    assert.ok(Object.isFrozen(res));
    for(const val of [input.name,input.email,input.phone].filter(Boolean))
      assert.equal(JSON.stringify(res).includes(val),false);
  }
});

test('F79: a supplied invalid secondary contact defeats otherwise valid minimum',()=>{
  for(const input of [
    draft('Teste','not-an-email','+5511999999999'),
    draft('Teste','cliente@example.test','broken'),
    draft('Teste','cliente@example.test','1234567'),
    draft('Teste','bad@example.test ','+5511999999999'),
    draft('Teste',null,'0000000000000000')
  ]){
    const result=inspect(input);
    assert.equal(result.invalidSuppliedContact,true);
    assert.equal(result.meetsStructuralMinimum,false);
  }
});

test('F79: malformed synthetic fields rejected before scoring',()=>{
  for(const input of [
    null,{},[],{name:'Teste',email:'cliente@example.test'},
    {...draft(),consent:true},
    draft(' \t ','cliente@example.test',null),
    draft('Teste','',null),draft('Teste',null,''),
    draft('Teste\nBcc:someone@example.test','cliente@example.test',null),
    draft('A'.repeat(1025),'cliente@example.test',null),
    draft('Teste','cliente@example.test',123)
  ])assert.throws(()=>inspect(input),/F79: (invalid|unsupported) synthetic draft/);
});

test('F79: approximation explicitly DOES NOT replace F30 stricter commercial draft policy',()=>{
  const phoneOnly=inspect(draft('Teste',null,'+5511999999999'));
  assert.equal(phoneOnly.meetsStructuralMinimum,true);
  assert.throws(()=>validateSyntheticLeadDraft({
    name:'Teste',email:'',phone:'+5511999999999',serviceSlug:'landing-pages',
    details:'Solicitação completamente fictícia para uma empresa.',
    consent:true,honeypot:''
  }),/invalid email/);
  const labSource=readFileSync(new URL('../src/lib/crm-form-minimum-parity-lab.mjs',import.meta.url),'utf8');
  const publicPage=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  assert.match(labSource,/NOT normative parity/);
  assert.doesNotMatch(labSource,/fetch\s*\(|XMLHttpRequest|sendBeacon\s*\(|localStorage|process\.env/);
  assert.doesNotMatch(publicPage,/crm-form-minimum-parity-lab|<form\b|<input\b/i);
});

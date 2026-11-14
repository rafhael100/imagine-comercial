import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSyntheticLeadDraft,SyntheticLeadInbox}
  from '../src/lib/lead-intake-lab.mjs';

const draft=()=>({
  name:'Pessoa Sintética',email:'test@example.invalid',phone:'',
  serviceSlug:'landing-pages',
  details:'Solicitação totalmente fictícia para o ambiente de teste.',
  consent:true,honeypot:''
});
const key='41e554fa-3a2d-4e4e-9ecb-8a9ec95c5501';

test('F284 ordinary synthetic draft still passes without real lead receipt',()=>{
  const result=validateSyntheticLeadDraft(draft());
  assert.equal(result.consent,true);
  assert.equal(result.schema,'imagine.comercial.lead-draft.v1');
  assert.equal(new SyntheticLeadInbox().submit(draft(),key).outcome,'accepted_lab_only');
});

test('F284 malformed hidden or inherited fields cannot masquerade as reviewed lead',()=>{
  const hidden=draft();
  Object.defineProperty(hidden,'secret',{value:'PRIVATE-F284',enumerable:false});
  const injected=draft();
  injected[Symbol('pii')]='PRIVATE-F284';
  const inherited=Object.assign(Object.create({billingId:'PRIVATE-F284'}),draft());
  const absent={...draft()};delete absent.honeypot;
  const alternative=Object.assign(Object.create(null),draft());
  for(const data of [hidden,injected,inherited,absent,alternative])
    assert.throws(()=>validateSyntheticLeadDraft(data),
      /unsupported or missing public fields/);
});

test('F284 no synthetic lead accessors may run even on consent',()=>{
  let calls=0;
  for(const field of Object.keys(draft())){
    const data=draft();
    Object.defineProperty(data,field,{enumerable:true,
      get(){calls++;throw Error('PRIVATE-F284-GETTER');}
    });
    try{
      validateSyntheticLeadDraft(data);
      assert.fail('getter should have been rejected');
    }catch(error){
      assert.match(String(error),/unsupported or missing public fields/);
      assert.doesNotMatch(String(error),/PRIVATE-F284/);
    }
  }
  assert.equal(calls,0);
});

test('F284 invalid drafts cannot enter even the synthetic idempotent inbox',()=>{
  const inbox=new SyntheticLeadInbox();
  const injected=draft();
  Object.defineProperty(injected,'consent',{enumerable:true,
    get(){throw Error('PRIVATE-F284');}
  });
  assert.throws(()=>inbox.submit(injected,key),
    /unsupported or missing public fields/);
  assert.equal(inbox.count,0);
});

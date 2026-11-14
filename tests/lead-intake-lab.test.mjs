import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSyntheticLeadDraft,SyntheticLeadInbox} from '../src/lib/lead-intake-lab.mjs';

const fixture=()=>({
  name:'  Maria   Silva ',email:' MARIA+ORCAMENTO@EXAMPLE.COM ',
  phone:'+5511999999999',serviceSlug:'landing-pages',
  details:'Preciso de uma página para apresentar minha empresa.',
  consent:true,honeypot:''
});
const key='41e554fa-3a2d-4e4e-9ecb-8a9ec95c5501';

test('F30: canonical synthetic lead draft requires explicit consent and known service',()=>{
  const draft=validateSyntheticLeadDraft(fixture());
  assert.equal(draft.schema,'imagine.comercial.lead-draft.v1');
  assert.equal(draft.name,'Maria Silva');
  assert.equal(draft.email,'maria+orcamento@example.com');
  assert.equal(draft.serviceSlug,'landing-pages');
  assert.equal(draft.consent,true);
  assert.ok(Object.isFrozen(draft));
});
test('F30: reject absent or preassumed consent and honeypot data',()=>{
  for(const consent of [false,null,undefined,'true',1]){
    assert.throws(()=>validateSyntheticLeadDraft({...fixture(),consent}),
      /explicit contact consent/);
  }
  assert.throws(()=>validateSyntheticLeadDraft({...fixture(),honeypot:'robot'}),
    /bot trap/);
});
test('F30: require exact input schema; avoid hidden PII and invented product slugs',()=>{
  assert.throws(()=>validateSyntheticLeadDraft({...fixture(),cpf:'12345678900'}),
    /unsupported or missing public fields/);
  const missing=fixture(); delete missing.email;
  assert.throws(()=>validateSyntheticLeadDraft(missing),
    /unsupported or missing public fields/);
  assert.throws(()=>validateSyntheticLeadDraft({...fixture(),serviceSlug:'fake-plan'}),
    /unknown service/);
  assert.throws(()=>validateSyntheticLeadDraft(null),/unsupported or missing public fields/);
});
test('F30: validate email, phone, text length and name injection',()=>{
  for(const email of ['not-an-email','person@@example.com','person@example','a..b@example.com']){
    assert.throws(()=>validateSyntheticLeadDraft({...fixture(),email}),/invalid email/);
  }
  for(const phone of ['not-phone','11999999999','+00123456789','+123']){
    assert.throws(()=>validateSyntheticLeadDraft({...fixture(),phone}),/invalid E.164 phone/);
  }
  for(const name of ['A','Alice\r\nBcc: attacker@example.com','<script>attack</script>']){
    assert.throws(()=>validateSyntheticLeadDraft({...fixture(),name}),/invalid contact name/);
  }
  for(const details of ['short','a'.repeat(1601),'Mensagem completa \0 insegura']){
    assert.throws(()=>validateSyntheticLeadDraft({...fixture(),details}),/invalid message/);
  }
});
test('F30: idempotent retry returns same receipt but changed payload is rejected',()=>{
  const inbox=new SyntheticLeadInbox();
  const first=inbox.submit(fixture(),key);
  assert.equal(first.mode,'SYNTHETIC_IN_MEMORY_NO_NETWORK');
  assert.equal(first.outcome,'accepted_lab_only');
  assert.equal(first.receiptId,key);
  assert.equal(inbox.count,1);
  const retry=inbox.submit(fixture(),key);
  assert.equal(retry.outcome,'duplicate_ack');
  assert.equal(inbox.count,1);
  assert.throws(()=>inbox.submit({...fixture(),details:'Pedido alterado sem novo ID de tentativa.'},key),
    /idempotency conflict/);
  assert.equal(inbox.count,1);
});
test('F30: invalid requests never become a received lead',()=>{
  const inbox=new SyntheticLeadInbox();
  assert.throws(()=>inbox.submit({...fixture(),consent:false},key),/explicit contact consent/);
  assert.throws(()=>inbox.submit(fixture(),'maria@example.com'),/invalid idempotency UUID/);
  assert.throws(()=>inbox.submit({schema:'imagine.comercial.lead-draft.v1'},key),
    /unsupported or missing public fields/);
  assert.equal(inbox.count,0);
});
test('F30: synthetic receipts disclose no name, phone, email or request details',()=>{
  const input=fixture();
  const receipt=new SyntheticLeadInbox().submit(input,key);
  const publicJson=JSON.stringify(receipt);
  for(const value of [input.name.trim(),input.phone,'maria+orcamento@example.com',input.details]){
    assert.equal(publicJson.includes(value),false);
  }
  assert.equal(Object.hasOwn(receipt,'details'),false);
  assert.equal(Object.hasOwn(receipt,'email'),false);
});

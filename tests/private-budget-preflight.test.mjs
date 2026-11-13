import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessPrivateBudgetPreview} from '../src/lib/private-budget-preflight.mjs';
import {services} from '../src/data/services.mjs';
import {reviewPortalCrmOperationalBoundary} from '../src/lib/portal-crm-operational-boundary.mjs';
const sample=()=>({
  name:'Pessoa de Teste',role:'',email:'pessoa@example.invalid',
  phone:'',mobile:'',serviceSlug:'onepage',
  details:'Projeto demonstrativo sem dados pessoais reais.',
  challengePreview:'5',previewUnderstanding:true
});
test('P0 F157: private legacy-shaped sample is not a public lead or a receipt',()=>{
  const r=assessPrivateBudgetPreview(sample());
  assert.equal(r.code,'STRUCTURAL_PREVIEW_ONLY_NO_AUTHORITY');
  assert.equal(r.structureMatches,true);
  for(const k of ['publicIntakeAllowed','consentProvenanceVerified','serverAntiBotVerified',
    'authenticatedTenantVerified','durableCrmReceiptVerified','canPersist',
    'canSendToPortal','canSendToCrm','canAcknowledgeVisitor',
    'canReplaceLegacyBudgetForm','canDeploy'])assert.equal(r[k],false,k);
  const serialized=JSON.stringify(r);
  for(const value of ['Pessoa de Teste','pessoa@example.invalid','Projeto demonstrativo'])
    assert.ok(!serialized.includes(value));
  assert.ok(Object.isFrozen(r));
  assert.equal(reviewPortalCrmOperationalBoundary().canCollectPublicLeads,false);
});
test('P0 F157: each service is recognized without admitting an unknown service',()=>{
  for(const service of services)
    assert.equal(assessPrivateBudgetPreview({...sample(),serviceSlug:service.slug}).structureMatches,true);
  assert.equal(assessPrivateBudgetPreview({...sample(),serviceSlug:'evil'}).code,'UNRECOGNIZED_SERVICE');
});
test('P0 F157: structural minimum accepts email or valid telephone, not unverified consent',()=>{
  const onlyPhone={...sample(),email:'',phone:'+55 85 99999-9999'};
  assert.equal(assessPrivateBudgetPreview(onlyPhone).structureMatches,true);
  assert.equal(assessPrivateBudgetPreview({...sample(),email:'',mobile:'+5585999999999'}).structureMatches,true);
  for(const draft of [
    {...sample(),email:'',phone:'',mobile:''},
    {...sample(),email:'not-an-email'},
    {...sample(),email:'a@example.invalid',mobile:'123'},
    {...sample(),previewUnderstanding:false},
    {...sample(),previewUnderstanding:'true'}
  ])assert.equal(assessPrivateBudgetPreview(draft).canSendToCrm,false);
  assert.equal(assessPrivateBudgetPreview({...sample(),previewUnderstanding:false}).code,
    'PREVIEW_ACKNOWLEDGEMENT_REQUIRED');
});
test('P0 F157: reject prototype, symbol, accessor, omissions, arbitrary field and hostile types',()=>{
  let invoked=false;
  const getter=sample();
  Object.defineProperty(getter,'name',{enumerable:true,get(){invoked=true;throw Error('secret')}});
  const symbol=sample();symbol[Symbol('extra')]='x';
  for(const draft of [
    null,42,'',[],Object.create(null),Object.assign(Object.create({admin:true}),sample()),
    {...sample(),extra:'approved'},(()=>{const s=sample();delete s.role;return s;})(),
    getter,symbol,{...sample(),name:{value:'ok'}},
    {...sample(),details:'x'.repeat(1601)}, {...sample(),challengePreview:'x'.repeat(4)}
  ]){
    const r=assessPrivateBudgetPreview(draft);
    assert.equal(r.canDeploy,false);
    assert.notEqual(r.code,'STRUCTURAL_PREVIEW_ONLY_NO_AUTHORITY');
  }
  assert.equal(invoked,false);
});
test('P0 F157: no public capture route or form is enabled',()=>{
  const publicContact=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  assert.doesNotMatch(publicContact,/<form\b|<input\b|fetch\s*\(/);
  const lab=readFileSync(new URL('./fixtures/private-contact-form-preview.html',import.meta.url),'utf8');
  assert.match(lab,/<button type="submit" disabled/);
  assert.match(lab,/method="dialog"/);
});

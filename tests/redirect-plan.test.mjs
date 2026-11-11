import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyUrls } from '../src/data/legacy-urls.mjs';
import { validateRedirectPlan, toCloudflareRedirectRules } from '../src/lib/redirect-plan.mjs';

const approved=(from,to)=>({from,to,status:'approved',reason:'Equivalência editorial revisada pelo responsável.'});
test('legacy inventory is transparent and generates no active redirect',()=>{
  const plan=validateRedirectPlan(legacyUrls);
  assert.equal(plan.active.length,0);
  assert.equal(toCloudflareRedirectRules(plan),'');
  assert.ok(plan.entries.some(x=>x.from==='/clientes.html' && x.status==='hold'));
});
test('emits only individually reviewed approved candidates',()=>{
  const plan=validateRedirectPlan([approved('/fale-conosco.html','/contato/'),
    {from:'/clientes.html',to:null,status:'hold',reason:'Sem equivalente editorial publicado atualmente.'}]);
  assert.equal(toCloudflareRedirectRules(plan),'/fale-conosco.html /contato/ 301');
});
test('rejects external targets and missing content destinations',()=>{
  assert.throws(()=>validateRedirectPlan([approved('/legado.html','https://external.example/')]), /invalid target/);
  assert.throws(()=>validateRedirectPlan([approved('/legado.html','/pagina-inexistente/')]), /destination not part/);
});
test('rejects homepage wildcard rules, duplicates and ambiguous states',()=>{
  assert.throws(()=>validateRedirectPlan([approved('/*','/')]), /invalid source/);
  assert.throws(()=>validateRedirectPlan([approved('/a.html','/sobre/'),approved('/a.html','/contato/')]), /duplicate source/);
  assert.throws(()=>validateRedirectPlan([{from:'/a.html',to:'/sobre/',status:'unknown',reason:'Revisão com contexto suficiente.'}]), /invalid state/);
});
test('rejects redirects that form chains, self loops or collide with public routes',()=>{
  assert.throws(()=>validateRedirectPlan([
    approved('/a.html','/contato/'),
    approved('/contato/','/sobre/')
  ]), /chain or loop|source conflicts with a published or reserved route/);
  assert.throws(()=>validateRedirectPlan([approved('/sobre/','/sobre/')]), /self redirect|source conflicts with a published or reserved route/);
});
test('hold cannot silently point at content and plans are immutable',()=>{
  assert.throws(()=>validateRedirectPlan([
    {from:'/clientes.html',to:'/sobre/',status:'hold',reason:'Pendente de revisão de portfólio.'}
  ]), /hold must have null/);
  const result=validateRedirectPlan(legacyUrls);
  assert.ok(Object.isFrozen(result.entries));
  assert.ok(Object.isFrozen(result.active));
});

test('legacy privacy/terms page remains protected from an unrelated redirect',()=>{
  const item=legacyUrls.find(e=>e.from==='/en-us/termos-de-uso.html');
  assert.ok(item);
  assert.equal(item.to,null);
  assert.equal(item.status,'hold');
  const plan=validateRedirectPlan(legacyUrls);
  assert.ok(!toCloudflareRedirectRules(plan).includes('termos-de-uso'));
});

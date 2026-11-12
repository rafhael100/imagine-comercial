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

test('F221 two additional publicly observed English pages remain explicit HOLD',()=>{
  const paths=[
    '/en-us/services/criacao-de-sites-institucional.html',
    '/en-us/services/youtube-ads-anuncios.html'
  ];
  const plan=validateRedirectPlan(legacyUrls);
  for(const path of paths){
    const entry=plan.entries.find(item=>item.from===path);
    assert.ok(entry,'reviewed public route must remain inventoried');
    assert.equal(entry.status,'hold');
    assert.equal(entry.to,null);
    assert.ok(!plan.active.some(x=>x.from===path));
    assert.ok(!toCloudflareRedirectRules(plan).includes(path));
  }
  assert.equal(plan.entries.length,27);
  assert.equal(plan.active.length,0);
});

test('F223 LinkedIn Business and Portuguese legal terms cannot silently redirect',()=>{
  const paths=[
    '/o-que-fazemos/linkedin-business.html',
    '/termos-de-uso.html'
  ];
  const result=validateRedirectPlan(legacyUrls);
  assert.equal(result.entries.length,27);
  assert.equal(result.entries.filter(x=>x.status==='candidate').length,5);
  assert.equal(result.entries.filter(x=>x.status==='hold').length,22);
  assert.equal(result.active.length,0);
  for(const path of paths){
    const entry=result.entries.find(x=>x.from===path);
    assert.ok(entry);
    assert.equal(entry.status,'hold');
    assert.equal(entry.to,null);
    assert.equal(toCloudflareRedirectRules(result).includes(path),false);
  }
});

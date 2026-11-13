import test from 'node:test';
import assert from 'node:assert/strict';
import {auditInPageFragments} from '../src/lib/in-page-fragment-contract.mjs';
import {auditCrossPageFragmentTargets} from '../src/lib/cross-page-fragment-contract.mjs';

const page=(path,body)=>({path,html:'<html lang="pt-BR"><main>'+body+'</main></html>'});

test('F270 in-page fragments require real ID rather than prefixed ID',()=>{
  assert.equal(auditInPageFragments('<section id="secao"></section><a href="#secao">Ver</a>').samePageLinksChecked,1);
  for(const attr of ['data-id','aria-id']){
    assert.throws(()=>auditInPageFragments(
      '<section '+attr+'="secao">Fake</section><a href="#secao">Ir</a>'
    ),/target not present/);
  }
  assert.throws(()=>auditInPageFragments(
    '<section id="secao"></section><a data-href="#secao">Falso</a>'
  ),/F268:/);
  assert.throws(()=>auditInPageFragments(
    '<section id="secao"></section><a href="#secao" href="#outro">Duplicado</a>'
  ),/F268:/);
});

test('F270 cross-page links require actual ID on target document',()=>{
  const good=[
    page('/','<a href="/como-funciona/#etapas">Etapas</a>'),
    page('/como-funciona/','<section id="etapas">Etapas</section>')
  ];
  assert.equal(auditCrossPageFragmentTargets(good).staticTargetsChecked,1);
  const fake=good.map(x=>({...x}));
  fake[1].html=fake[1].html.replace('id="etapas"','data-id="etapas"');
  assert.throws(()=>auditCrossPageFragmentTargets(fake),/neither a real ID/);
  fake[1].html=fake[1].html.replace('data-id="etapas"','aria-id="etapas"');
  assert.throws(()=>auditCrossPageFragmentTargets(fake),/neither a real ID/);
});

test('F270 cross-page phantom href never counts as navigation or valid intent',()=>{
  const source=[
    page('/','<a data-href="/contato/#landing-pages">Não é um link</a>'),
    page('/contato/','<div id="service-choice">Seleção</div>')
  ];
  assert.throws(()=>auditCrossPageFragmentTargets(source),/F268:/);
  source[0]=page('/','<a href="/contato/#landing-pages">Contato</a>');
  assert.equal(auditCrossPageFragmentTargets(source).approvedContactIntents,1);
});

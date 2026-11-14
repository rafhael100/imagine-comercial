import test from 'node:test';
import assert from 'node:assert/strict';
import {auditInPageFragments as audit}
  from '../src/lib/in-page-fragment-contract.mjs';

test('F147 accepts skip navigation and anchored sections with unique IDs',()=>{
  const html='<html><body>'+
    '<a href="#conteudo">Pular para conteúdo</a>'+
    '<main id="conteudo"><a href="#etapas">Ver etapas</a>'+
    '<section id="etapas"><h2 id="etapas-title">Etapas</h2></section></main></body></html>';
  const result=audit(html);
  assert.equal(result.samePageLinksChecked,2);
  assert.equal(result.uniqueIds,3);
  assert.equal(result.networkPerformed,false);
});
test('F147 refuses missing anchor IDs and duplicate IDs in compiled HTML',()=>{
  assert.throws(()=>audit('<main><a href="#nao-existe">Erro</a></main>'),
    /local fragment target not present/);
  assert.throws(()=>audit('<main id="conteudo"><div id="conteudo"></div></main>'),
    /duplicate or empty anchor ID/);
  assert.throws(()=>audit('<main id=""><a href="#conteudo">Erro</a></main>'),
    /duplicate or empty anchor ID/);
});
test('F147 leaves cross-page service selection fragments to contact-page flow',()=>{
  const html='<main id="conteudo"><a href="/contato/#landing-pages">'+
    'Enviar proposta</a><a href="#conteudo">Voltar ao início</a></main>';
  const result=audit(html);
  assert.equal(result.samePageLinksChecked,1);
});
test('F147 errors never quote source content, IDs or customer terms',()=>{
  try{
    audit('<main><a href="#PERSON-SECRET-ID">Pessoa</a></main>');
    assert.fail('broken link should be refused');
  }catch(error){
    assert.doesNotMatch(String(error),/PERSON-SECRET-ID/);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {auditAccessibleLinkNames as audit}
  from '../src/lib/accessible-link-contract.mjs';

const page=children=>'<html><body>'+children+'</body></html>';

test('F151 approves meaningful visible text, aria-label and image alt',()=>{
  const result=audit(page(
    '<a href="/servicos/">Conheça as soluções</a>'+
    '<a href="/" aria-label="Página inicial"><span aria-hidden="true">↗</span></a>'+
    '<a href="/sobre/"><img src="/logo.svg" alt="Sobre a Imagine"></a>'
  ));
  assert.equal(result.namedLinksChecked,3);
  assert.equal(result.networkPerformed,false);
  assert.ok(Object.isFrozen(result));
});

test('F151 rejects icon-only, empty, unlabeled and excessive link names',()=>{
  for(const link of [
    '<a href="/">↗</a>',
    '<a href="/"></a>',
    '<a href="/"><span aria-hidden="true">✓</span></a>',
    '<a href="/"><img src="/icon.svg" alt=""></a>',
    '<a href="/" aria-label=" "></a>',
    '<a href="/">'+('conteúdo '.repeat(40))+'</a>'
  ])assert.throws(()=>audit(page(link)),/link missing a meaningful accessible name/);
});

test('F151 rejects malformed or unclosed anchors and accepts normal HTML entities',()=>{
  assert.throws(()=>audit(page('<a href="/"><b>Sem fechamento</b>')),
    /malformed or unclosed anchor markup/);
  assert.equal(audit(page('<a href="/conteudos/">Conteúdo &amp; guias</a>'))
    .namedLinksChecked,1);
});

test('F151 never echoes potentially sensitive link text to diagnostics',()=>{
  try{
    audit(page('<a href="/"><span aria-hidden="true">↗</span>'+
      '<script>const secret="PERSON-SECRET-F151";</script></a>'));
    assert.fail('script text must not grant an accessible name');
  }catch(error){
    assert.doesNotMatch(String(error),/PERSON-SECRET-F151/);
  }
});

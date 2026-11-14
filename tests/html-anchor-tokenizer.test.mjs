import test from 'node:test';
import assert from 'node:assert/strict';
import {anchorOpeningTags} from '../src/lib/html-anchor-reader.mjs';
import {auditCuratedInternalLinks} from '../src/lib/internal-link-contract.mjs';
import {auditPublicLinkGraph} from '../src/lib/public-link-graph.mjs';

const good='<a href="/contato/" title="Contato > Imagine">';
const linked=good+'Contato</a>';

test('F286 fake anchors inside another tag attribute do not create public links',()=>{
  for(const fake of [
    '<div data-note='+"'"+'<a href="/servicos/">'+"'"+'></div>',
    '<section aria-label="Veja <a href='+"'"+'/servicos/'+"'"+'>"></section>',
    '<script data-preview='+"'"+'<a href="/servicos/">'+"'"+'>var x=1;</script>',
    '<textarea data-preview='+"'"+'<a href="/servicos/">'+"'"+'>Texto sem links</textarea>',
    '<title data-preview='+"'"+'<a href="/servicos/">'+"'"+'>Imagine</title>'
  ]){
    assert.deepEqual(anchorOpeningTags(fake),[]);
    assert.throws(()=>auditCuratedInternalLinks(fake,['/','/servicos/']),
      /expected public navigation/);
    assert.throws(()=>auditPublicLinkGraph([
      {path:'/',html:fake},{path:'/servicos/',html:'<a href="/">Voltar</a>'}
    ]),/orphan public pages/);
  }
});

test('F286 a real link after a quoted fake remains reachable exactly once',()=>{
  const source='<div data-example='+"'"+'<a href="/servicos/">'+"'"+'></div>'+good;
  assert.deepEqual(anchorOpeningTags(source),[good]);
  assert.equal(auditCuratedInternalLinks(source,['/','/contato/']).checkedLinks,1);
});

test('F286 nested inert templates do not invent navigation',()=>{
  const hidden='<a href="/servicos/">Serviço não ativo</a>';
  const markup='<template><template>'+hidden+'</template>'+
    '<div>'+hidden+'</div></template>'+good;
  assert.deepEqual(anchorOpeningTags(markup),[good]);
  assert.equal(auditCuratedInternalLinks(markup,['/','/contato/']).checkedLinks,1);
});

test('F286 quoted greater-than sign and fallback noscript remain supported',()=>{
  assert.deepEqual(anchorOpeningTags(
    '<main data-summary="A > B">'+linked+'</main>'
  ),[good]);
  assert.equal(anchorOpeningTags(
    '<noscript><a href="/servicos/">Serviços sem JS</a></noscript>'
  ).length,1);
});

test('F286 malformed unclosed tag does not turn a fake attr into real navigation',()=>{
  assert.throws(()=>anchorOpeningTags('<a href="/contato/" title="unclosed'),
    /F268: unterminated opening tag/);
});

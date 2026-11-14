import test from 'node:test';
import assert from 'node:assert/strict';
import {anchorOpeningTags} from '../src/lib/html-anchor-reader.mjs';
import {auditCuratedInternalLinks} from '../src/lib/internal-link-contract.mjs';
import {auditPublicLinkGraph} from '../src/lib/public-link-graph.mjs';

const phantom='<a href="/servicos/">Falso caminho público</a>';
const inert=['script','style','template','textarea','title','xmp','iframe','noembed','noframes'];

test('F285 raw and RCDATA containers cannot forge clickable links',()=>{
  for(const tag of inert){
    const page='<'+tag+' data-context="curated">'+phantom+'</'+tag+'>';
    assert.deepEqual(anchorOpeningTags(page),[],tag);
    assert.throws(()=>auditCuratedInternalLinks(page,['/','/servicos/']),
      /expected public navigation/,tag);
    assert.throws(()=>auditPublicLinkGraph([
      {path:'/',html:page},
      {path:'/servicos/',html:'<a href="/">Voltar</a>'}
    ]),/orphan public pages/,tag);
  }
});

test('F285 viable navigation alongside inactive markup is still audited',()=>{
  for(const tag of inert){
    const html='<'+tag+'>'+phantom+'</'+tag+'>'+
      '<a href="/contato/" title="Atendimento > contato">Contato verdadeiro</a>';
    assert.deepEqual(anchorOpeningTags(html),
      ['<a href="/contato/" title="Atendimento > contato">'],tag);
    assert.equal(auditCuratedInternalLinks(html,['/','/contato/']).checkedLinks,1);
  }
});

test('F285 noscript remains navigable for visitors without JavaScript',()=>{
  const fallback='<noscript><a href="/servicos/">Serviços</a></noscript>';
  assert.equal(anchorOpeningTags(fallback).length,1);
  assert.equal(auditCuratedInternalLinks(fallback,['/','/servicos/']).checkedLinks,1);
});

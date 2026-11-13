import test from 'node:test';
import assert from 'node:assert/strict';
import {anchorOpeningTags} from '../src/lib/html-anchor-reader.mjs';
import {auditPublicLinkGraph} from '../src/lib/public-link-graph.mjs';
import {auditCuratedInternalLinks} from '../src/lib/internal-link-contract.mjs';

test('F275 comments and inert raw text cannot impersonate real public links',()=>{
  const fake='<a href="/servicos/">Link fantasma</a>';
  for(const html of [
    '<!-- '+fake+' -->',
    '<!-- '+fake,
    '<script>const markup='+JSON.stringify(fake)+';</script>',
    '<style>div:after{content:'+JSON.stringify(fake)+'}</style>',
    '<template>'+fake+'</template>'
  ]){
    assert.deepEqual(anchorOpeningTags(html),[]);
    assert.throws(()=>auditCuratedInternalLinks(html,['/','/servicos/']),
      /expected public navigation/);
    assert.throws(()=>auditPublicLinkGraph([
      {path:'/',html},
      {path:'/servicos/',html:'<a href="/">Voltar</a>'}
    ]),/orphan public pages/);
  }
});

test('F275 no-JS links remain part of the public navigation audit',()=>{
  const fallback='<noscript><a href="/servicos/">Serviços sem JS</a></noscript>';
  assert.equal(anchorOpeningTags(fallback).length,1);
  assert.equal(auditCuratedInternalLinks(fallback,['/','/servicos/']).checkedLinks,1);
  assert.equal(auditPublicLinkGraph([
    {path:'/',html:fallback},
    {path:'/servicos/',html:'<a href="/">Início</a>'}
  ]).reachablePages,2);
});

test('F275 real links beside inert samples remain usable and counted exactly once',()=>{
  const html='<script>const s="<a href=/fantasma/>";</script>'+
    '<!-- <a href="/fantasma/">ruim</a> -->'+
    '<a href="/servicos/" title="Link > correto">Serviços</a>';
  assert.deepEqual(anchorOpeningTags(html),
    ['<a href="/servicos/" title="Link > correto">']);
  assert.equal(auditCuratedInternalLinks(html,['/','/servicos/']).checkedLinks,1);
});

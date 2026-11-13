import test from 'node:test';
import assert from 'node:assert/strict';
import {anchorOpeningTags,requiredAnchorHref} from '../src/lib/html-anchor-reader.mjs';
import {auditCuratedInternalLinks} from '../src/lib/internal-link-contract.mjs';
import {auditPublicLinkGraph} from '../src/lib/public-link-graph.mjs';

const ROUTES=['/','/servicos/','/contato/'];

test('F268 real href wins over deceptive prefixed and quoted attributes',()=>{
  for(const tag of [
    '<a data-href="/servicos/" aria-label="href=/wrong/" href="/contato/">',
    '<A aria-href="/wrong/" HREF="/contato/" data-href="/servicos/">',
    '<a title="Please use href=/fake/" href='+"'"+'/contato/'+"'"+'>',
    '<a aria-label="Veja > os serviços" href="/contato/">'
  ])assert.equal(requiredAnchorHref(tag),'/contato/');
  assert.deepEqual(anchorOpeningTags(
    '<div><a title="x > y" href="/servicos/">Veja</a><a href="/contato/">Contato</a></div>'
  ),['<a title="x > y" href="/servicos/">','<a href="/contato/">']);
  assert.equal(auditCuratedInternalLinks('<A href="/servicos/">Serviços</A>',ROUTES).checkedLinks,1);
});

test('F268 no href, duplicate href and unquoted href are rejected',()=>{
  for(const tag of [
    '<a data-href="/servicos/">',
    '<a aria-href="/servicos/">',
    '<a title="href=/servicos/">',
    '<a href=/servicos/>',
    '<a href="/servicos/" href="/contato/">',
    '<a href="" HREF="/contato/">',
    '<a href="/contato/" href="/contato/">',
    '<a href="/contato/" onclick="bad" href="/contato/">',
    '<a href="/contato/" data-x="foo"'
  ])assert.throws(()=>requiredAnchorHref(tag),/F268:/);
  assert.throws(()=>anchorOpeningTags('<a title="unterminated'),/F268:/);
});

test('F268 global link audit will not accept fake clickable paths',()=>{
  for(const tag of [
    '<a data-href="/servicos/">Falso</a>',
    '<a aria-href="/servicos/">Falso</a>',
    '<a title="href=/servicos/">Falso</a>',
    '<a href="/servicos/" href="/contato/">Duplicado</a>',
    '<a href=/servicos/>Sem aspas</a>'
  ])assert.throws(()=>auditCuratedInternalLinks(tag,ROUTES),/F268:/);
});

test('F268 route reachability cannot be forged through aria-href or data-href',()=>{
  const legitimate=[
    {path:'/',html:'<a href="/servicos/">Soluções</a>'},
    {path:'/servicos/',html:'<a href="/">Início</a>'}
  ];
  assert.equal(auditPublicLinkGraph(legitimate).reachablePages,2);
  for(const fake of ['data-href','aria-href']){
    const bogus=[
      {...legitimate[0],html:'<a '+fake+'="/servicos/">Link fantasma</a>'},
      legitimate[1]
    ];
    assert.throws(()=>auditPublicLinkGraph(bogus),/F268:/);
  }
});

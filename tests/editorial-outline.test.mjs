import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {articles} from '../src/data/articles.mjs';
import {
  editorialHeadingId,createEditorialOutline
} from '../src/lib/editorial-outline.mjs';

test('F153 every published article has stable unique readable section anchors',()=>{
  for(const article of articles){
    const outline=createEditorialOutline(article);
    assert.equal(outline.length,article.sections.length);
    assert.ok(Object.isFrozen(outline));
    assert.equal(new Set(outline.map(section=>section.id)).size,outline.length);
    for(const [i,section] of outline.entries()){
      assert.match(section.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.equal(section.heading,article.sections[i][0]);
      assert.deepEqual(section.paragraphs,article.sections[i].slice(1));
      assert.ok(Object.isFrozen(section));
      assert.ok(Object.isFrozen(section.paragraphs));
    }
  }
});

test('F153 accent and punctuation normalization keeps anchor URLs stable',()=>{
  assert.equal(editorialHeadingId('O que avaliar antes de contratar'),
    'o-que-avaliar-antes-de-contratar');
  assert.equal(editorialHeadingId('Como o SEO influencia a escolha'),
    'como-o-seo-influencia-a-escolha');
  assert.equal(editorialHeadingId('Gestão, métricas & decisões'),
    'gestao-metricas-decisoes');
});

test('F153 rejects duplicate section anchors and unsupported inputs without leaking copy',()=>{
  const para='Informações suficientemente detalhadas para uma seção editorial.';
  for(const sample of [
    {sections:[['Gestão e métricas',para],['Gestao e metricas',para]]},
    {sections:[['GESTÃO E MÉTRICAS',para],['Gestão e métricas',para]]},
    {sections:[['Um cabeçalho longo e claro',para],[' ',para]]},
    {sections:[['Um cabeçalho longo e claro',para],['Outro cabeçalho', 'curto']]},
    {sections:[['Um cabeçalho longo e claro',para]]}
  ])assert.throws(()=>createEditorialOutline(sample),/F153/);
  assert.throws(()=>editorialHeadingId('PERSON-SECRET-SECTION\n'),/F153/);
  assert.throws(()=>editorialHeadingId('  texto com espaços  '),/F153/);
});

test('F153 article template keeps approved section links without visitor capture or outbound requests',()=>{
  const template=readFileSync(
    new URL('../src/pages/conteudos/[slug].astro',import.meta.url),'utf8');
  assert.match(template,/createEditorialOutline\(article\)/);
  assert.match(template,/aria-label="Sumário deste guia"/);
  assert.match(template,/href=\{'#'\+section\.id\}/);
  assert.match(template,/id=\{section\.id\}/);
  assert.match(template,/outline\.map/);
  // F304 deliberately allows local-only clipboard enhancement of the
  // already-approved section anchors, never a form or network transport.
  assert.match(template,/window\.location\.origin\+window\.location\.pathname\+'#'\+id/);
  assert.doesNotMatch(template,/<form\b|<input\b|<textarea\b|fetch\s*\(|sendBeacon\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie/i);
});

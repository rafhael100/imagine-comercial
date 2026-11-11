import test from 'node:test';
import assert from 'node:assert/strict';
import {fortalezaSiteGuide as guide} from '../src/data/article-fortaleza.mjs';
import {articles} from '../src/data/articles.mjs';
import {sitePages,toAbsoluteUrl} from '../src/data/services.mjs';

const path='/conteudos/criacao-de-sites-fortaleza-guia/';
test('F141 includes one contextual editorial guide in public routes and static sitemap',()=>{
  assert.equal(articles.filter(a=>a.slug===guide.slug).length,1);
  assert.equal(sitePages.filter(a=>a.path===path).length,1);
  assert.equal(toAbsoluteUrl(path),
    'https://imaginecomunicacao.com.br/conteudos/criacao-de-sites-fortaleza-guia/');
  assert.match(guide.title,/Fortaleza/);
  assert.match(guide.heading,/Fortaleza/);
  assert.ok(guide.description.length>=65&&guide.description.length<=180);
  assert.match(guide.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});
test('F141 offers substantive, unique content without invented locations or ranking',()=>{
  assert.equal(guide.sections.length,5);
  assert.equal(new Set(guide.sections.map(s=>s[0])).size,5);
  assert.ok(guide.sections.every(s=>s.length===3));
  const all=guide.sections.flatMap(s=>s.slice(1)).join(' ');
  assert.ok(all.split(/\s+/).length>=500,'expected thorough procurement guide');
  assert.doesNotMatch(all,/garantimos (?:o )?primeiro lugar|ranking garantido|100% de resultados/i);
  assert.doesNotMatch(all,/\b(?:Rua|Avenida)\s+[A-Z][^,.]{4,}\s*,?\s*\d{1,4}/);
  assert.ok(guide.links.every(link=>sitePages.some(item=>item.path===link.href)));
  assert.ok(guide.links.some(link=>link.href==='/servicos/criacao-de-sites/'));
});
test('F141 reuses the same indexable Article JSON-LD layout, without inventing author',()=>{
  assert.equal(typeof guide.publishedAt,'undefined');
  assert.equal(typeof guide.author,'undefined');
  assert.equal(typeof guide.rating,'undefined');
  assert.equal(typeof guide.price,'undefined');
  assert.equal(typeof guide.streetAddress,'undefined');
  assert.ok(Object.isFrozen(guide));
});

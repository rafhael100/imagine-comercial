import test from 'node:test';
import assert from 'node:assert/strict';
import { articles } from '../src/data/articles.mjs';
import { sitePages } from '../src/data/services.mjs';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('all articles have distinct slugs, titles, descriptions and canonical sitemap routes',()=>{
  assert.ok(articles.length>=4);
  for(const key of ['slug','title','description','heading'])assert.equal(new Set(articles.map(a=>a[key])).size,articles.length);
  for(const a of articles){
    assert.match(a.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(sitePages.some(p=>p.path==='/conteudos/'+a.slug+'/'));
    assert.ok(a.description.length>=65&&a.description.length<=180);
    assert.ok(a.sections.length>=4);
    assert.ok(a.links.length>=2);
  }
});
test('editorial content has substantiveness and contextual links',()=>{
  for(const a of articles){
    const words=a.sections.flatMap(s=>s.slice(1)).join(' ').split(/\s+/).length;
    assert.ok(words>=250,a.slug+': insufficient original text');
    const heads=a.sections.map(s=>s[0]);
    assert.equal(new Set(heads).size,heads.length,a.slug+': duplicate section');
    for(const section of a.sections)assert.ok(section.length>=3,a.slug+': section needs two paragraphs');
    for(const link of a.links){
      assert.match(link.href,/^\/(?:[a-z0-9-]+\/)*$/);
      assert.ok(sitePages.some(p=>p.path===link.href),a.slug+': missing linked page');
    }
  }
});
test('article renderer is static and includes a real article schema entry',()=>{
  const template=read('src/pages/conteudos/[slug].astro');
  const layout=read('src/layouts/BaseLayout.astro');
  assert.ok(template.includes('getStaticPaths'));
  assert.ok(template.includes('<h1>{article.heading}</h1>'));
  assert.ok(layout.includes("'@type': 'Article'"));
  assert.ok(template.includes('href="/contato/"'));
});

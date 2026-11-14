import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {articles} from '../src/data/articles.mjs';
import {sitePages} from '../src/data/services.mjs';
import {relatedGuidesFor} from '../src/data/related-articles.mjs';

test('F154 every article has two unique, reviewed, public related guides',()=>{
  const catalog=new Map(articles.map(article=>[
    '/conteudos/'+article.slug+'/',article
  ]));
  for(const article of articles){
    const related=relatedGuidesFor(article.slug);
    assert.equal(related.length,2,article.slug);
    assert.ok(Object.isFrozen(related));
    assert.equal(new Set(related.map(x=>x.href)).size,2);
    for(const guide of related){
      assert.ok(catalog.has(guide.href),guide.href);
      assert.ok(sitePages.some(p=>p.path===guide.href));
      assert.notEqual(guide.href,'/conteudos/'+article.slug+'/');
      assert.equal(guide.title,catalog.get(guide.href).heading);
      assert.equal(guide.topic,catalog.get(guide.href).eyebrow);
      assert.ok(Object.isFrozen(guide));
    }
  }
});

test('F154 recommendations are semantic, not arbitrary or user-selected',()=>{
  assert.ok(relatedGuidesFor('google-ads-ou-meta-ads').some(x=>
    x.href==='/conteudos/landing-page-ou-site/'));
  assert.ok(relatedGuidesFor('criacao-de-sites-fortaleza-guia').some(x=>
    x.href==='/conteudos/seo-para-sites-empresariais/'));
  assert.deepEqual(relatedGuidesFor('../private'),[]);
  assert.deepEqual(relatedGuidesFor(null),[]);
});

test('F154 uses static accessible links, not a client recommendation script',()=>{
  const template=readFileSync(
    new URL('../src/pages/conteudos/[slug].astro',import.meta.url),'utf8');
  assert.match(template,/relatedGuidesFor\(article\.slug\)/);
  assert.match(template,/aria-labelledby="related-reading-title"/);
  assert.match(template,/href=\{guide\.href\}/);
  assert.match(template,/guide\.title/);
  assert.doesNotMatch(template,/fetch\s*\(|<form\b|<input\b|<iframe\b/i);
});

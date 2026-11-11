import test from 'node:test';
import assert from 'node:assert/strict';
import {articles} from '../src/data/articles.mjs';
import {services,sitePages} from '../src/data/services.mjs';
import {relatedEditorialGuides} from '../src/data/service-related-guides.mjs';
import {readFileSync} from 'node:fs';

test('F142 maps each published service to relevant, existing editorial routes',()=>{
  const catalog=new Map(articles.map(article=>[
    '/conteudos/'+article.slug+'/',article
  ]));
  for(const service of services){
    const guides=relatedEditorialGuides(service.slug);
    assert.ok(guides.length>=1&&guides.length<=3,service.slug);
    assert.equal(new Set(guides.map(x=>x.href)).size,guides.length,service.slug);
    for(const guide of guides){
      assert.ok(sitePages.some(p=>p.path===guide.href),guide.href);
      assert.equal(guide.title,catalog.get(guide.href)?.heading);
      assert.equal(guide.label,catalog.get(guide.href)?.eyebrow);
      assert.ok(Object.isFrozen(guide));
    }
    assert.ok(Object.isFrozen(guides));
  }
});
test('F142 selects true Fortaleza buying guide only for site creation',()=>{
  const site=relatedEditorialGuides('criacao-de-sites');
  assert.ok(site.some(x=>x.href==='/conteudos/criacao-de-sites-fortaleza-guia/'));
  for(const service of services.filter(x=>x.slug!=='criacao-de-sites')){
    assert.ok(!relatedEditorialGuides(service.slug).some(
      x=>x.href==='/conteudos/criacao-de-sites-fortaleza-guia/'));
  }
  assert.deepEqual(relatedEditorialGuides('unknown-service'),[]);
  assert.deepEqual(relatedEditorialGuides('../../../../etc/passwd'),[]);
  assert.deepEqual(relatedEditorialGuides(null),[]);
});
test('F142 renders guide links from curated catalog without external targets',()=>{
  const template=readFileSync(
    new URL('../src/pages/servicos/[slug].astro',import.meta.url),'utf8');
  assert.match(template,/relatedEditorialGuides\(s\.slug\)/);
  assert.match(template,/href=\{guide\.href\}/);
  assert.match(template,/relatedGuides\.length > 0/);
  assert.match(template,/aria-labelledby="related-guides-title"/);
  assert.doesNotMatch(template,/window\.location|target="_blank".*guide\.href/);
});

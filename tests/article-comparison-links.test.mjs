import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {articles} from '../src/data/articles.mjs';
import {comparisonOptions} from '../src/data/service-comparison.mjs';
import {decodeReviewedComparisonFragment} from '../src/data/reviewed-comparison-fragment.mjs';
import {comparisonForArticle} from '../src/data/article-comparison-links.mjs';

test('F200 only two real comparison guides link to exact reviewed service pairs',()=>{
  const expected=new Map([
    ['landing-page-ou-site',['criacao-de-sites','landing-pages']],
    ['google-ads-ou-meta-ads',['gestao-google-ads','gestao-meta-ads']]
  ]);
  const options=new Set(comparisonOptions.map(x=>x.slug));
  for(const article of articles){
    const outbound=comparisonForArticle(article.slug);
    if(!expected.has(article.slug)){assert.equal(outbound,null);continue;}
    assert.ok(Object.isFrozen(outbound));
    assert.equal(outbound.label,'Comparar as duas soluções lado a lado');
    assert.ok(outbound.href.startsWith('/comparar-solucoes/#comparar:'));
    assert.equal(new URL(outbound.href,'https://imaginecomunicacao.com.br').search,'');
    const pair=decodeReviewedComparisonFragment(outbound.href.split('/comparar-solucoes/')[1]);
    assert.deepEqual(pair,expected.get(article.slug));
    for(const slug of pair)assert.ok(options.has(slug));
  }
});
test('F200 ignores unknown guides and refuses to invent links or destinations',()=>{
  for(const bad of ['',null,undefined,{},'__proto__','constructor',
    '../contato','x@example.invalid','landing-page-ou-site?token=1']){
    assert.throws(()=>comparisonForArticle(bad),/unknown public article slug/);
  }
});
test('F200 generated article markup includes only reviewed, static comparison CTA',()=>{
  const source=readFileSync(new URL('../src/pages/conteudos/[slug].astro',import.meta.url),'utf8');
  assert.match(source,/comparisonForArticle\(article\.slug\)/);
  assert.match(source,/data-article-comparison href={relevantComparison\.href}/);
  assert.match(source,/relevantComparison &&/);
  assert.doesNotMatch(source,/<form\b|<input\b|<textarea\b|fetch\s*\(|localStorage|sessionStorage|document\.cookie/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {articles} from '../src/data/articles.mjs';
import {sitePages} from '../src/data/services.mjs';
import {guideTopics,topicsForGuide,guidesForTopic}
  from '../src/data/article-topics.mjs';
import {assertNoUnapprovedPublicIntake}
  from '../src/lib/public-intake-freeze.mjs';

test('F152 exposes only curated topics with exhaustive article coverage',()=>{
  assert.deepEqual(guideTopics.map(t=>t.code),[
    'all','sites','landing-pages','seo','anuncios','contratacao'
  ]);
  assert.equal(guidesForTopic('all').length,articles.length);
  for(const a of articles){
    const topics=topicsForGuide(a.slug);
    assert.ok(topics.length>=1);
    assert.ok(topics.every(t=>guideTopics.some(item=>item.code===t)));
    assert.equal(new Set(topics).size,topics.length);
    assert.ok(sitePages.some(p=>p.path==='/conteudos/'+a.slug+'/'));
    assert.ok(Object.isFrozen(topics));
  }
  for(const topic of guideTopics){
    assert.ok(guidesForTopic(topic.code).length>0,topic.code);
    assert.ok(Object.isFrozen(guidesForTopic(topic.code)));
  }
});
test('F152 article topics have meaningful editorial intent without invented destinations',()=>{
  assert.deepEqual(guidesForTopic('anuncios').map(a=>a.slug),
    ['google-ads-ou-meta-ads']);
  assert.ok(guidesForTopic('sites').some(a=>
    a.slug==='criacao-de-sites-fortaleza-guia'));
  assert.ok(guidesForTopic('seo').some(a=>
    a.slug==='seo-para-sites-empresariais'));
  assert.deepEqual(guidesForTopic('unreviewed'),[]);
  assert.deepEqual(topicsForGuide('../secret'),[]);
  assert.deepEqual(guidesForTopic(null),[]);
});
test('F152 filter is progressively enhanced without public intake or new requests',()=>{
  const html=readFileSync(
    new URL('../src/pages/conteudos/index.astro',import.meta.url),'utf8');
  assert.match(html,/id="guide-topic-filters"/);
  assert.match(html,/aria-pressed=\{topic\.code/);
  assert.match(html,/aria-controls="guide-list"/);
  assert.match(html,/id="guide-filter-status"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/data-guide-categories/);
  assert.match(html,/guide-filter-button/);
  assert.match(html,/\.guide-filters\[data-enhanced="true"\]/);
  assert.doesNotMatch(html,/<(?:input|form|textarea)\b/i);
  assert.doesNotMatch(html,/\b(?:fetch|XMLHttpRequest|sendBeacon)\s*\(/);
  assertNoUnapprovedPublicIntake('conteudos/index.html',html);
});

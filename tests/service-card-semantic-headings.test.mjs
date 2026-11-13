import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';

const catalog=readFileSync(new URL('../src/pages/servicos/index.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F262 service catalog section has one H2 and nested card H3 headings',()=>{
  assert.equal(services.length,6);
  assert.match(catalog,/<h2 id="service-catalog-title">Explore todas as soluções<\/h2>/);
  assert.match(catalog,/<article class="card" data-service-group=\{categoryForService\(s.slug\)\}>[\s\S]*?<h3>\{s.label\}<\/h3>/);
  assert.doesNotMatch(catalog,/<h2>\{s.label\}<\/h2>/);
  assert.match(catalog,/href=\{'\/servicos\/' \+ s.slug \+ '\/'\}/);
});
test('F262 Chromium QA checks actual semantic headings on mobile and desktop',()=>{
  assert.match(browser,/F262 service cards use nested H3 titles/);
  assert.match(browser,/F262 service cards do not compete with section H2/);
});

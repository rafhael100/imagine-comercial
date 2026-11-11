import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(
  new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F156 browser accessibility audits both editorial entry and guide page',()=>{
  assert.match(source,/route==='\/conteudos\/'/);
  assert.match(source,/route==='\/conteudos\/landing-page-ou-site\/'/);
  assert.match(source,/new AxeBuilder\(\{page\}\)/);
  assert.match(source,/filteredAccessibility\.violations/);
});
test('F156 keyboard reaches and operates filters and native anchor navigation',()=>{
  assert.match(source,/filterButton\('landing-pages'\)\.focus\(\)/);
  assert.match(source,/page\.keyboard\.press\('Enter'\)/);
  assert.match(source,/outlineLinks\.first\(\)\.focus\(\)/);
  assert.match(source,/waitForURL\(host\+'\/conteudos\/landing-page-ou-site\/'\+firstSection\)/);
});
test('F156 remains restricted to private local Playwright origin',()=>{
  assert.match(source,/host = 'http:\/\/127\.0\.0\.1:'/);
  assert.match(source,/unexpectedRequests/);
  assert.match(source,/no external request or POST/);
  assert.match(source,/javaScriptEnabled:false/);
});

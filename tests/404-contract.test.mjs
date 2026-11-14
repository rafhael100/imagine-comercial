import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sitePages} from '../src/data/services.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('404 is intentionally excluded from the curated sitemap',()=>{
  assert.equal(sitePages.some(x=>x.path==='/404/'),false);
});
test('404 uses noindex and keeps helpful, real navigation',()=>{
  const markup=read('src/pages/404.astro');
  assert.ok(markup.includes('noindex={true}'));
  assert.ok(markup.includes('href="/servicos/"'));
  assert.ok(markup.includes('href="/contato/"'));
  assert.ok(markup.includes('href="/"'));
});
test('generic noindex pages do not emit canonical or public-page structured data',()=>{
  const layout=read('src/layouts/BaseLayout.astro');
  assert.ok(layout.includes('{!noindex && <link rel="canonical"'));
  assert.ok(layout.includes('{!noindex && <script type="application/ld+json"'));
  assert.ok(layout.includes("noindex ? 'noindex,nofollow' : 'index,follow'"));
});
test('browser QA checks actual HTTP status and noindex of errors',()=>{
  const qa=read('scripts/browser-qa.mjs');
  assert.ok(qa.includes("notFoundResponse?.status(),404"));
  assert.ok(qa.includes("'noindex,nofollow'"));
});

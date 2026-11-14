import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sitePages} from '../src/data/services.mjs';

const layout=readFileSync(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

const navRoutes=['/servicos/','/comparar-solucoes/','/servicos/landing-pages/',
  '/conteudos/','/sobre/','/contato/'];

test('F63 navigation links to existing canonical pages and marks current only for exact route',()=>{
  for(const route of navRoutes){
    assert.ok(sitePages.some(page=>page.path===route),route+' must exist in canonical catalog');
    assert.ok(layout.includes('href="'+route+'" aria-current={pathname===\''+route+'\'?\'page\':undefined}'),
      route+' current-page semantics');
  }
  assert.ok(layout.includes('aria-current={pathname===\'/\'?\'page\':undefined}'),
    'brand only marks home when on homepage');
});
test('F63 never uses fake active-page markers or additional visitor tracking',()=>{
  assert.match(layout,/nav a\[aria-current="page"\]/);
  assert.match(layout,/<nav aria-label="Navegação principal">/);
  assert.match(layout,/<a href="#conteudo" class="skip-link">Ir para o conteúdo<\/a>/);
  assert.doesNotMatch(layout,/window\.location|localStorage|sessionStorage|fetch\(|document\.cookie|onclick=/);
});
test('F63 QA covers current navigation and keyboard skip control',()=>{
  assert.match(qa,/nav\[aria-label="Navegação principal"\] a\[aria-current="page"\]/);
  assert.match(qa,/page\.keyboard\.press\('Tab'\)/);
  assert.match(qa,/a\.skip-link:focus-visible/);
});

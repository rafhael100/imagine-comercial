import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sitePages} from '../src/data/services.mjs';

const layout=readFileSync(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');
const browserQa=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F150: a native details mobile menu uses only reviewed internal pages',()=>{
  assert.match(layout,/<details class="mobile-menu">\s*<summary>Menu<\/summary>/);
  assert.match(layout,/<nav class="mobile-nav" aria-label="Navegação móvel">/);
  const start=layout.indexOf('<nav class="mobile-nav"');
  const end=layout.indexOf('</nav>',start);
  const section=layout.slice(start,end);
  const urls=[...section.matchAll(/<a href="(\/[^"]+)" aria-current/g)].map(x=>x[1]);
  assert.deepEqual(urls,[
    '/servicos/','/comparar-solucoes/','/servicos/landing-pages/',
    '/conteudos/','/como-funciona/','/perguntas-frequentes/',
    '/sobre/','/contato/'
  ]);
  assert.ok(urls.every(url=>sitePages.some(page=>page.path===url)));
  assert.equal(new Set(urls).size,urls.length);
});

test('F150: mobile menu is keyboard accessible and not script-dependent',()=>{
  assert.match(layout,/\.mobile-menu\s*\{\s*display:\s*none;/);
  assert.match(layout,/@media \(max-width: 820px\)/);
  assert.match(layout,/\.header > nav\[aria-label="Navegação principal"\]\s*\{\s*display: none;/);
  assert.match(layout,/\.mobile-menu\s*\{\s*display: block;/);
  assert.doesNotMatch(layout,/<script[^>]*>[\s\S]*?mobile-menu[\s\S]*?<\/script>/);
  assert.match(browserQa,/F150 Enter opens native mobile menu/);
  assert.match(browserQa,/F150 no-JS disclosure opens without scripts/);
});

test('F150: Portal login remains hidden unless its configured URL passed allowlist',()=>{
  assert.match(layout,/portalLoginUrl && <a class="nav-cta-mobile" href=\{portalLoginUrl\}/);
  assert.match(layout,/portalLoginUrl && <a class="nav-cta" href=\{portalLoginUrl\}/);
  assert.doesNotMatch(layout,/\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|\bdocument\.cookie\b/);
});

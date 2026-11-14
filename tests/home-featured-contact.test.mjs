import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services,sitePages} from '../src/data/services.mjs';
const home=readFileSync(new URL('../src/pages/index.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F252 homepage feature shortcuts are limited to existing published services',()=>{
  const featured=services.filter(s=>['criacao-de-sites','landing-pages','gestao-google-ads'].includes(s.slug));
  assert.deepEqual(featured.map(s=>s.slug),['criacao-de-sites','landing-pages','gestao-google-ads']);
  for(const service of featured)
    assert.ok(sitePages.some(page=>page.path==='/servicos/'+service.slug+'/'));
  assert.match(home,/const featured = services\.filter/);
  assert.match(home,/data-home-service-contact href=\{'\/contato\/#'\+s\.slug\}/);
  assert.match(home,/aria-describedby="home-featured-contact-notice"/);
});
test('F252 homepage provides labeled contact shortcuts without sending a request',()=>{
  assert.match(home,/aria-label=\{'Preparar contato sobre '\+s\.label\}/);
  assert.match(home,/id="home-featured-contact-notice"/);
  assert.match(home,/sem enviar um pedido/);
  assert.match(home,/\.home-featured-actions a\{display:inline-flex;align-items:center;min-height:44px/);
  assert.match(home,/\.home-featured-actions a:focus-visible\{outline:3px solid #b45b00/);
  assert.doesNotMatch(home,/<(?:form|input|textarea)\b|\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/);
});
test('F252 browser contract visits home and verifies contact service selection',()=>{
  for(const phrase of ['F252 three featured solutions offer contact shortcuts',
    'F252 homepage shortcuts use reviewed public service slugs',
    'F252 visitors see the no-send note',
    'F252 homepage link selects the correct service in contact'])
    assert.ok(browser.includes(phrase),phrase);
});

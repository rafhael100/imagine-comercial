import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';

const page=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
const servicePage=readFileSync(new URL('../src/pages/servicos/[slug].astro',import.meta.url),'utf8');

test('F62 contact deep links remain constrained to the reviewed service select',()=>{
  assert.match(page,/new Set\(\[\.\.\.choice\.options\]/);
  assert.match(page,/allowed\.has\(requested\) \? requested : ''/);
  assert.match(page,/allowed\.has\(choice\.value\)/);
  assert.match(page,/window\.location\.hash\.slice\(1\)/);
  assert.match(page,/window\.addEventListener\('hashchange', applyFragment\)/);
  assert.match(page,/window\.addEventListener\('popstate', applyFragment\)/);
  assert.match(page,/window\.history\.replaceState\(null, ''/);
  assert.match(page,/window\.location\.pathname \+ window\.location\.search \+ fragment/);
  assert.equal(services.length,6);
  assert.ok(services.every(s=>/^[a-z0-9-]+$/.test(s.slug)));
});
test('F62 accessible selection status, no tracking or network-backed lead submission',()=>{
  assert.match(page,/id="service-choice"[^>]+aria-describedby="service-help"/);
  assert.match(page,/id="service-help" role="status" aria-live="polite"/);
  assert.match(page,/help\.textContent = label/);
  assert.match(page,/Nenhum dado será enviado pelo site/);
  assert.doesNotMatch(page,/<form\b|fetch\(|XMLHttpRequest|WebSocket|sendBeacon\(|localStorage|sessionStorage|document\.cookie|innerHTML/);
});
test('F62 service secondary CTA reaches the actual public comparison route',()=>{
  assert.match(servicePage,/<a class="cta cta-secondary" href="\/comparar-solucoes\/">Comparar soluções<\/a>/);
  assert.doesNotMatch(servicePage,/<a class="cta cta-secondary" href="\/servicos\/">Comparar soluções<\/a>/);
});

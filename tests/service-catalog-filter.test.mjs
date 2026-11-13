import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services,sitePages} from '../src/data/services.mjs';
import {serviceCatalogGroups,categoryForService}
  from '../src/data/service-catalog-groups.mjs';

const page=readFileSync(new URL('../src/pages/servicos/index.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F250 only six reviewed public services can be categorized',()=>{
  assert.deepEqual(serviceCatalogGroups.map(x=>x.code),[
    'all','sites','assinaturas','anuncios'
  ]);
  assert.equal(services.length,6);
  assert.equal(services.filter(x=>categoryForService(x.slug)==='sites').length,3);
  assert.equal(services.filter(x=>categoryForService(x.slug)==='assinaturas').length,1);
  assert.equal(services.filter(x=>categoryForService(x.slug)==='anuncios').length,2);
  for(const s of services){
    assert.ok(Object.isFrozen(serviceCatalogGroups[0]));
    assert.ok(serviceCatalogGroups.some(g=>g.code===categoryForService(s.slug)));
    assert.ok(sitePages.some(x=>x.path==='/servicos/'+s.slug+'/'));
  }
  for(const invalid of [null,{},'../internal','outro-servico',''])
    assert.equal(categoryForService(invalid),null);
});
test('F250 page renders all catalog cards on server with no-JS fallback',()=>{
  assert.match(page,/import \{serviceCatalogGroups,categoryForService\}/);
  assert.match(page,/id="service-catalog-filters"[^>]* hidden>/);
  assert.match(page,/data-service-category=\{group.code\}/);
  assert.match(page,/aria-pressed=\{group.code==='all'/);
  assert.match(page,/data-service-group=\{categoryForService\(s.slug\)\}/);
  assert.match(page,/id="service-catalog-status"[^>]*role="status" aria-live="polite"/);
  assert.match(page,/\.service-catalog-filters\[hidden\],\.service-catalog-grid \[hidden\]/);
});
test('F250 local filter uses category allowlist and never captures visitor data',()=>{
  assert.match(page,/const allowedCategories=new Set/);
  assert.match(page,/if\(!allowedCategories.has\(category\)\)return/);
  assert.match(page,/card.hidden=!match/);
  assert.match(page,/button.setAttribute\('aria-pressed'/);
  assert.match(page,/categoryControls.hidden=false/);
  assert.match(page,/applyCategory\('all'\)/);
  assert.doesNotMatch(page,/<(?:form|input|textarea)\b|\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/);
  for(const phrase of ['F250 sites category has exactly three services',
    'F250 ads category has exactly two services',
    'F250 subscription category has one reviewed service',
    'F250 all services remain visible without JS',
    'F250 filters never modify URL or browser history'])
    assert.ok(browser.includes(phrase),phrase);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services,sitePages} from '../src/data/services.mjs';
import {decodeCuratedBriefingFragment} from '../src/data/curated-briefing-fragment.mjs';

const source=readFileSync(new URL('../src/pages/servicos/index.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');
test('F251 only published service slugs can be embedded in card contact shortcuts',()=>{
  assert.equal(services.length,6);
  for(const s of services){
    assert.match(s.slug,/^[a-z0-9-]+$/);
    assert.ok(sitePages.some(page=>page.path==='/servicos/'+s.slug+'/'));
    const url='/contato/#'+s.slug;
    assert.ok(url.startsWith('/contato/#'));
    assert.equal(decodeCuratedBriefingFragment('#'+s.slug),null,
      'legacy static slug must not masquerade as compound briefing');
  }
  assert.match(source,/data-service-card-contact href=\{'\/contato\/#'\+s\.slug\}/);
  assert.match(source,/aria-label=\{'Preparar contato sobre '\+s\.label\}/);
  assert.match(source,/aria-describedby="service-catalog-contact-notice"/);
});
test('F251 direct contact is a progressive accessible link and cannot submit leads',()=>{
  assert.match(source,/id="service-catalog-contact-notice"/);
  assert.match(source,/Nenhum dado é enviado por esse clique/);
  assert.match(source,/\.service-card-actions a\{display:inline-flex;align-items:center;min-height:44px/);
  assert.match(source,/\.service-card-actions a:focus-visible\{outline:3px solid #b45b00/);
  assert.doesNotMatch(source,/<(?:form|input|textarea)\b|\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/);
});
test('F251 browser proves card destination is reviewed and contact service is selected',()=>{
  for(const phrase of [
    'F251 all service cards offer direct preparation links',
    'F251 links contain only reviewed public service identifiers',
    'F251 direct card-to-contact link preselects reviewed service',
    'F251 the visitor sees no-send boundary'
  ])assert.ok(browser.includes(phrase),phrase);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';
import {comparisonOptions} from '../src/data/service-comparison.mjs';

const page=readFileSync(new URL('../src/pages/comparar-solucoes.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F174 two-service shortlist is built only from approved comparison catalog',()=>{
  assert.equal(comparisonOptions.length,6);
  assert.deepEqual(new Set(comparisonOptions.map(x=>x.slug)),
    new Set(services.map(x=>x.slug)));
  assert.match(page,/import \{comparisonOptions\} from '\.\.\/data\/service-comparison\.mjs';/);
  assert.match(page,/data-compare-select=\{item\.slug\}/);
  assert.match(page,/const catalog=new Map\(comparisonOptions\.map/);
  assert.match(page,/else if\(selected\.size<2&&catalog\.has\(slug\)\)selected\.add\(slug\)/);
  assert.match(page,/button\.disabled=!active&&selected\.size===2;/);
  assert.match(page,/button\.setAttribute\('aria-pressed',String\(active\)\)/);
  assert.match(page,/selectedList\.replaceChildren\(\)/);
  assert.match(page,/selectedSection\.hidden=cards\.length===0;/);
});
test('F174 shortlist is progressive enhancement without form/PII/remote transport',()=>{
  assert.match(page,/data-compare-select=\{item\.slug\}[\s\S]*aria-pressed="false" aria-controls="selected-comparison" hidden/);
  assert.match(page,/id="compare-chooser-status"[^>]*role="status" aria-live="polite"/);
  assert.match(page,/id="selected-comparison"[^>]*hidden/);
  assert.match(page,/button\.hidden=false;/);
  assert.match(page,/status\.hidden=false;/);
  assert.match(page,/detail\.href=item\.detailHref;/);
  assert.match(page,/contact\.href=item\.contactHref;/);
  assert.doesNotMatch(page,/<form\b|<input\b|<textarea\b|fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|innerHTML/);
});
test('F174 browser tests click, max 2, removal, links and no-JS',()=>{
  for(const value of ['F174 selected exactly two real services',
    'F174 never accepts a third selected service',
    'F174 all six comparison cards stay visible without JavaScript',
    'F174 shortlist buttons are hidden without JavaScript'])
    assert.ok(browser.includes(value),value);
});

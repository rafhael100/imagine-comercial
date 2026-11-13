import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {commercialFaqSections} from '../src/data/commercial-faq.mjs';

const faq=readFileSync(new URL('../src/pages/perguntas-frequentes.astro',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');
test('F248 topic selectors are strictly drawn from the reviewed public FAQ catalog',()=>{
  assert.equal(commercialFaqSections.length,4);
  assert.equal(commercialFaqSections.flatMap(x=>x.questions).length,8);
  assert.match(faq,/data-faq-topic="all" aria-pressed="true"/);
  assert.match(faq,/data-faq-topic=\{section.code\} aria-pressed="false"/);
  assert.match(faq,/data-faq-section=\{section.code\}/);
  assert.match(faq,/const availableTopics=new Set\(sections.map/);
  assert.match(faq,/if\(topic!=='all'&&!availableTopics.has\(topic\)\)return/);
});
test('F248 progressive controls are hidden without JS and native FAQ content survives',()=>{
  assert.match(faq,/id="faq-topic-controls"[^>]* hidden>/);
  assert.match(faq,/id="faq-answer-controls" hidden>/);
  assert.match(faq,/id="faq-filter-status"[^>]* hidden>/);
  assert.match(faq,/<details class="faq-item">/);
  assert.match(faq,/\.faq-index a\[href\^="#"/);
  assert.match(faq,/answer\.open=true/);
  assert.match(faq,/if\(!approved\.has\(anchor\)\)return/);
});
test('F248 buttons announce selection, hide only known sections and preserve hash reveal',()=>{
  assert.match(faq,/aria-label="Filtrar perguntas por tema"/);
  assert.match(faq,/aria-pressed/);
  assert.match(faq,/status\.textContent=topic==='all'/);
  assert.match(faq,/section\.hidden=topic!=='all'/);
  assert.match(faq,/item\.open=open/);
  assert.match(faq,/applyFilter\('all'\); \/\/ valid deep links/);
  assert.match(faq,/role="status" aria-live="polite"/);
  assert.match(faq,/focus-visible/);
});
test('F248 preserves no-PII/no-state/no-telemetry FAQ boundary',()=>{
  assert.doesNotMatch(faq,/<form\b|<input\b|<textarea\b|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie|sendBeacon|history\.(?:pushState|replaceState)/);
  assert.match(qa,/F248 topic filtering limits visible FAQ categories/);
  assert.match(qa,/F248 valid FAQ deep link reveals hidden section/);
});

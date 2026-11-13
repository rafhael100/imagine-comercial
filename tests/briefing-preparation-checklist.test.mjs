import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preparationQuestions} from '../src/data/commercial-process.mjs';

const page=readFileSync(new URL('../src/pages/como-funciona.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F170 all six reviewed questions are present in progressively enhanced checklist',()=>{
  assert.equal(preparationQuestions.length,6);
  assert.match(page,/preparationQuestions\.map\(\(question,index\)=>/);
  assert.match(page,/id="briefing-list"/);
  assert.match(page,/data-briefing-task/);
  assert.match(page,/class="briefing-toggle" hidden aria-pressed="false"/);
  assert.match(page,/id="briefing-progress"[^>]*role="status" aria-live="polite"/);
  assert.match(page,/id="print-briefing" type="button"[^>]+hidden/);
  assert.match(page,/button\.setAttribute\('aria-pressed',String\(active\)\)/);
  assert.match(page,/print\.addEventListener\('click',\(\)=>window\.print\(\)\)/);
});
test('F170 public process checklist stores no data, never submits forms or creates external calls',()=>{
  assert.doesNotMatch(page,/<form\b|<input\b|<textarea\b|fetch\s*\(|sendBeacon\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie/);
  assert.match(page,/As marcações de preparo são temporárias/);
  assert.match(page,/\.briefing-toggle\[hidden\],#reset-preparation\[hidden\],#print-briefing\[hidden\],#copy-preparation-questions\[hidden\]\{display:none\}/);
  assert.match(page,/@media print\{/);
});
test('F170 browser QA tests interaction, reset, printing and no-JavaScript fallback',()=>{
  for(const snippet of ['F170 print only by direct click',
    'F170 selections are ephemeral, never persisted',
    'F170 no-JS checklist remains readable and inert',
    'F170 print enhancement stays hidden without JavaScript'])
    assert.ok(browser.includes(snippet),snippet);
});

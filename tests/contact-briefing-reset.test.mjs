import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F287 one action clears all four purely curated contact selections',()=>{
  assert.match(page,/<button type="button" id="reset-briefing"[^>]* hidden/);
  assert.match(page,/aria-controls="service-choice objective-choice stage-choice priority-choice message-preview"/);
  assert.match(page,/reset\.addEventListener\('click',\(\)=>\{/);
  for(const property of ['choice','objective','stage','priority'])
    assert.match(page,new RegExp(property+"\\.value='';"));
  assert.match(page,/window\.history\.replaceState\(null,'',window\.location\.pathname\)/);
  assert.match(page,/reset\.hidden = !\(choice\.value \|\| objective\.value \|\| stage\.value \|\| priority\.value\)/);
  assert.match(page,/choice\.focus\(\)/);
  assert.match(page,/\.contact-reset\{display:inline-flex;align-items:center;min-height:44px/);
  assert.match(page,/\.contact-reset\[hidden\]\{display:none!important\}/);
});

test('F287 reset remains progressively enhanced, with no submission or visitor storage',()=>{
  for(const banned of [/<form\b/i,/<input\b/i,/<textarea\b/i,/\bfetch\s*\(/,
    /XMLHttpRequest/,/sendBeacon\s*\(/,/sessionStorage/,/localStorage/,/document\.cookie/])
    assert.doesNotMatch(page,banned);
  assert.match(page,/const noJsContacts=services\.map/);
  assert.match(page,/<noscript>/);
  assert.match(qa,/F287 reset becomes available with curated choices/);
  assert.match(qa,/F287 clears local fragment/);
  assert.match(qa,/F287 restores the original WhatsApp message/);
  assert.match(qa,/F287 returns keyboard focus to first selector/);
});

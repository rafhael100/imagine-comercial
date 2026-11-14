import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/pages/comparar-solucoes.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F288 accessible one-click comparison reset is progressively enhanced',()=>{
  assert.match(page,/<button type="button" id="clear-comparison"[^>]* hidden/);
  assert.match(page,/aria-controls="selected-comparison-list"/);
  assert.match(page,/const clear=document\.querySelector<HTMLButtonElement>\('#clear-comparison'\)/);
  assert.match(page,/clear\.addEventListener\('click',\(\)=>\{/);
  assert.match(page,/selected\.clear\(\);\s+window\.history\.replaceState\(null,'',window\.location\.pathname\);\s+render\(\);\s+buttons\[0\]\?\.focus\(\)/);
  assert.match(page,/clear\.hidden=selected\.size===0/);
  assert.match(page,/\.compare-clear\{font:inherit;font-weight:750;cursor:pointer;\s+min-height:44px/);
  assert.match(page,/\.compare-clear\[hidden\]\{display:none!important\}/);
});

test('F288 reset does not create forms, tracking, backend submission or hidden intake',()=>{
  for(const forbidden of [/<form\b/i,/<input\b/i,/<textarea\b/i,
    /\bfetch\s*\(/,/\bsendBeacon\s*\(/,/\bXMLHttpRequest\b/,
    /\blocalStorage\b/,/\bsessionStorage\b/,/\bdocument\.cookie\b/])
    assert.doesNotMatch(page,forbidden);
  assert.match(browser,/F288 clear is visible when two services are selected/);
  assert.match(browser,/F288 removes both comparison cards/);
  assert.match(browser,/F288 restores keyboard focus to the first comparison control/);
  assert.match(page,/if\(selected.size===2\)window\.print\(\)/);
});

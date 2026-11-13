import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/pages/comparar-solucoes.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');
test('F203 print requires click and exactly two options',()=>{
  assert.match(page,/id="print-comparison"[^>]*hidden/);
  assert.match(page,/print\.hidden=selected\.size!==2/);
  assert.match(page,/print\.addEventListener\('click'/);
  assert.match(page,/if\(selected\.size===2\)window\.print\(\)/);
  assert.match(page,/@media print/);
  assert.match(page,/:global\(main#conteudo > :not\(#selected-comparison\)\)/);
  assert.match(page,/\.selected-comparison-list \.compare-links\{display:none!important\}/);
  assert.match(page,/#print-comparison\[hidden\]/);
});
test('F203 Chromium checks printed subset and no-JS fallback',()=>{
  assert.match(browser,/__testPairPrintCount/);
  assert.match(browser,/emulateMedia\(\{media:'print'\}\)/);
  assert.match(browser,/#comparacoes \.compare-card:visible/);
  assert.match(browser,/F203 print enhancement stays hidden without JavaScript/);
});
test('F203 never persists selections or performs public intake',()=>{
  assert.doesNotMatch(page,/<form\b|<input\b|<textarea\b|fetch\s*\(|localStorage|sessionStorage|sendBeacon|document\.cookie/);
});

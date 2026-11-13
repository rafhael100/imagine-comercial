import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const layout=readFileSync(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F291 skip link targets a keyboard-focusable main landmark',()=>{
  assert.match(layout,/<a href="#conteudo" class="skip-link">Ir para o conteúdo<\/a>/);
  assert.match(layout,/<main id="conteudo" tabindex="-1">/);
  assert.doesNotMatch(layout,/<main id="conteudo" tabindex="0">/);
  assert.match(layout,/\.skip-link:focus \{ top: 10px; \}/);
});

test('F291 real keyboard jump is checked on phone and desktop',()=>{
  assert.match(browser,/F291 skip link navigates to the approved main landmark/);
  assert.match(browser,/F291 skip link moves keyboard focus to the main landmark/);
  assert.match(browser,/page\.keyboard\.press\('Enter'\)/);
  assert.doesNotMatch(layout,/\bfetch\s*\(|\bXMLHttpRequest\b|sessionStorage|localStorage|document\.cookie/);
});

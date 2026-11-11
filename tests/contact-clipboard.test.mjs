import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const contact=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F151: clipboard action is an explicit visitor-initiated button, never a background send',()=>{
  assert.match(contact,/<button class="cta cta-secondary contact-copy" type="button" id="copy-message" hidden/);
  assert.match(contact,/copy.addEventListener\('click', async \(\) =>/);
  assert.match(contact,/navigator.clipboard\.writeText\(message\)/);
  assert.match(contact,/const message=composeCuratedBriefingLinks\(choice\.value,objective\.value,stage\.value,priority\.value\)\.message/);
  assert.match(contact,/if \(navigator.clipboard\?\.writeText\) copy.hidden = false/);
  assert.match(contact,/\.contact-copy\[hidden\] \{ display: none; \}/);
  assert.doesNotMatch(contact,/<form\b|<input\b|<textarea\b|fetch\(|sendBeacon\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie/);
});

test('F151: accessibility feedback and fallback remain available',()=>{
  assert.match(contact,/id="copy-message-status"[^>]*role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(contact,/copyStatus\.textContent='Mensagem copiada/);
  assert.match(contact,/Não foi possível copiar automaticamente/);
  assert.match(contact,/copyStatus\.textContent='';/);
  assert.match(browser,/F151 clipboard contains only curated briefing/);
  assert.match(browser,/F151 changing choices clears stale copy confirmation/);
  assert.match(browser,/F151 copy action stays hidden without JavaScript/);
});

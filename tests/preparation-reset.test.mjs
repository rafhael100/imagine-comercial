import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/pages/como-funciona.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F296 one action clears six in-memory preparation flags',()=>{
  assert.match(page,/<button id="reset-preparation" type="button" class="cta cta-secondary"\s+hidden aria-controls="briefing-list briefing-progress">Limpar marcações<\/button>/);
  assert.match(page,/const reset=document\.querySelector<HTMLButtonElement>\('#reset-preparation'\)/);
  assert.match(page,/reset\.hidden=done===0/);
  assert.match(page,/reset\.addEventListener\('click',\(\)=>\{/);
  assert.match(page,/button\.setAttribute\('aria-pressed','false'\)/);
  assert.match(page,/task\.dataset\.prepared='false'/);
  assert.match(page,/label\.textContent='Marcar como preparado'/);
  assert.match(page,/tasks\[0\]\?\.querySelector<HTMLButtonElement>\('\.briefing-toggle'\)\?\.focus\(\)/);
  assert.match(page,/#reset-preparation\[hidden\],#print-briefing\[hidden\]/);
});

test('F296 browser checks reset, focus, re-selection and no-JS fallback',()=>{
  for(const label of [
    'F296 progress resets immediately',
    'F296 all preparation flags cleared',
    'F296 returns focus to first checklist control',
    'F296 checklist remains reusable',
    'F296 reset enhancement stays hidden without JavaScript'
  ])assert.ok(browser.includes(label),label);
  for(const forbidden of [/<form\b/i,/<input\b/i,/<textarea\b/i,
    /\bfetch\s*\(/,/\blocalStorage\b/,/\bsessionStorage\b/,
    /\bdocument\.cookie\b/])
    assert.doesNotMatch(page,forbidden);
});

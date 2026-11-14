import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const layout=readFileSync(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F295 outside pointer closes only open native navigation disclosure',()=>{
  assert.match(layout,/const navDisclosures=\[\.\.\.document\.querySelectorAll<HTMLDetailsElement>/);
  assert.match(layout,/document\.addEventListener\('pointerdown',event=>\{/);
  assert.match(layout,/if\(!\(target instanceof Node\)\)return/);
  assert.match(layout,/if\(item\.open&&!item\.contains\(target\)\)item\.open=false/);
  assert.match(layout,/header details\.mobile-menu, header details\.nav-help/);
  assert.doesNotMatch(layout,/event\.target\.closest\('a'\)\.preventDefault/);
});

test('F295 click outside preserves native keyboard and no-JS navigation',()=>{
  assert.match(layout,/<details class="mobile-menu">\s*<summary>Menu<\/summary>/);
  assert.match(layout,/<details class="nav-help"/);
  assert.match(layout,/event\.key!=='Escape'\|\|!item\.open/);
  assert.match(layout,/item\.querySelector<HTMLElement>\('summary'\)\?\.focus\(\)/);
  assert.match(browser,/F295 clicking outside dismisses the desktop guidance menu/);
  assert.match(browser,/F295 clicking outside dismisses native mobile navigation/);
  assert.match(browser,/F295 mobile menu may reopen after outside dismissal/);
  assert.doesNotMatch(layout,/\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|\bdocument\.cookie\b/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const layout=readFileSync(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F290 Escape closes both native navigation menus and restores summary focus',()=>{
  assert.match(layout,/<details class="mobile-menu">/);
  assert.match(layout,/<details class="nav-help"/);
  assert.match(layout,/header details\.mobile-menu, header details\.nav-help/);
  assert.match(layout,/item\.addEventListener\('keydown',event=>\{/);
  assert.match(layout,/event\.key!=='Escape'\|\|!item\.open/);
  assert.match(layout,/item\.open=false/);
  assert.match(layout,/item\.querySelector<HTMLElement>\('summary'\)\?\.focus\(\)/);
  assert.match(layout,/event\.preventDefault\(\)/);
  assert.match(layout,/event\.stopPropagation\(\)/);
});

test('F290 no-JS details continue to function with zero tracking',()=>{
  assert.match(layout,/<summary>Menu<\/summary>/);
  assert.match(layout,/<summary>Orientações<\/summary>/);
  assert.doesNotMatch(layout,/\bfetch\s*\(|sendBeacon\s*\(|localStorage|sessionStorage|document\.cookie/);
  assert.match(qa,/F290 desktop guidance closes on Escape/);
  assert.match(qa,/F290 Escape closes native mobile navigation/);
  assert.match(qa,/F290 mobile focus returns to menu summary/);
  assert.match(qa,/F290 Enter reopens menu after Escape/);
});

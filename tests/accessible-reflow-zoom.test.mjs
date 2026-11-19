import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');
const layout=readFileSync(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');
test('F247 reflow equivalent viewport checks 200% of wide and compact screens',()=>{
  assert.match(browser,/width:640,height:820,label:'desktop-1280-at-200-percent'/);
  assert.match(browser,/width:320,height:720,label:'compact-640-at-200-percent'/);
  assert.match(browser,/F247 reflow menu available/);
  assert.match(browser,/F247 reflow hides oversized desktop links/);
  assert.match(browser,/F247 reflow contact reachable by keyboard-native menu/);
  assert.match(browser,/F247 readable main content/);
  assert.match(browser,/F247.*horizontal overflow/);
  assert.match(browser,/f247-.*-home\.png/);
});
test('F247 site keeps CSS responsive navigation and keyboard focus without JS',()=>{
  assert.match(layout,/@media \(max-width: 1020px\)/);
  assert.match(layout,/\.mobile-menu \{ display: block; position: relative;/);
  assert.match(layout,/:focus-visible \{ outline: 3px solid #b45b00/);
  assert.doesNotMatch(layout,/\b(?:localStorage|sessionStorage|fetch\s*\(|onclick\s*=)/);
});

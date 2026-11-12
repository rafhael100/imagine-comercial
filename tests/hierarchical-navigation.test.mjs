import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const layout=readFileSync(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F244 desktop header offers keyboard-native guidance without tracking or JS',()=>{
  assert.match(layout,/<details class="nav-help" data-section-active=\{guidanceSectionActive\?'true':undefined\}>/);
  assert.match(layout,/<summary>Orientações<\/summary>/);
  assert.match(layout,/<div class="nav-help-panel">/);
  assert.match(layout,/<a href="\/como-funciona\/" aria-current=/);
  assert.match(layout,/<a href="\/perguntas-frequentes\/" aria-current=/);
  assert.match(layout,/\.nav-help-panel a:hover, \.nav-help-panel a:focus-visible/);
  assert.doesNotMatch(layout,/onmouse(?:over|enter)|onclick|window\.location|fetch\s*\(/i);
});
test('F244 section highlights are separate from aria-current exact page',()=>{
  assert.match(layout,/const serviceSectionActive = pathname\.startsWith\('\/servicos\/'\)/);
  assert.match(layout,/const contentSectionActive = pathname\.startsWith\('\/conteudos\/'\)/);
  for(const route of ['/servicos/','/conteudos/']){
    const escaped=route.replace(/\//g,'\\/');
    assert.match(layout,new RegExp('href="'+escaped+'" aria-current=\\{pathname==='));
  }
  assert.match(layout,/data-section-active=\{serviceSectionActive\?'true':undefined\}/);
  assert.match(layout,/data-section-active=\{contentSectionActive\?'true':undefined\}/);
  assert.match(layout,/nav\[aria-label="Navegação principal"\] a\[data-section-active="true"\]/);
});
test('F244 tablet breakpoint retains touch targets and browser smoke',()=>{
  assert.match(layout,/@media \(max-width: 1020px\)/);
  assert.match(layout,/\.nav-help > summary \{ display: flex; align-items: center; min-height: 44px;/);
  assert.match(browser,/F244 tablet no horizontal overflow/);
  assert.match(browser,/F244 desktop guidance entry/);
  assert.match(browser,/F244 editorial section hierarchy/);
  assert.match(browser,/\/perguntas-frequentes\/'\]\)/);
});

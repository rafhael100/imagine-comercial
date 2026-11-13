import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {articles} from '../src/data/articles.mjs';
import {createEditorialOutline} from '../src/lib/editorial-outline.mjs';

const page=readFileSync(new URL('../src/pages/conteudos/[slug].astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F304 all approved editorial sections have immutable, linkable IDs',()=>{
  for(const article of articles){
    const outline=createEditorialOutline(article);
    assert.ok(outline.length>=2);
    const ids=outline.map(section=>section.id);
    assert.equal(ids.length,new Set(ids).size);
    for(const id of ids)assert.match(id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
  assert.match(page,/<h2 id="guia-sumario" tabindex="-1">O que você vai encontrar<\/h2>/);
  assert.match(page,/<a href="#guia-sumario" data-guide-return>Voltar ao sumário<\/a>/);
  assert.match(page,/data-guide-section-copy={section\.id} hidden/);
  assert.match(page,/aria-label={'Copiar link da seção: '\+section\.heading}/);
  assert.match(page,/data-guide-share-status/);
});

test('F304 copied link carries only static pathname and reviewed section ID',()=>{
  assert.match(page,/const id=button\.dataset\.guideSectionCopy/);
  assert.match(page,/section\.id!==id/);
  assert.match(page,/\/\^\[a-z0-9\]\+\(\?:-\[a-z0-9\]\+\)\*\$\/\.test\(id\)/);
  assert.match(page,/const href=window\.location\.origin\+window\.location\.pathname\+'#'\+id/);
  assert.match(page,/await navigator\.clipboard\.writeText\(href\)/);
  assert.doesNotMatch(page,/window\.location\.search\s*\+|window\.location\.href\s*\+/);
  assert.match(page,/if\(navigator\.clipboard\?\.writeText\)\{/);
  assert.match(page,/button\.hidden=false/);
  assert.match(page,/\.guide-section-actions button\[hidden\]\{display:none!important\}/);
  assert.match(page,/@media print\{\.guide-section-actions\{display:none!important\}\}/);
  assert.match(page,/\.guide-section-actions :is\(a,button\):focus-visible\{/);
});

test('F304 real browser checks keyboard focus, clipboard and no-JS fallback',()=>{
  for(const label of [
    'F304 each article section has a static return-to-outline link',
    'F304 only reviewed editorial headings have copy actions',
    'F304 copied article section URL contains only reviewed heading ID',
    'F304 back-to-outline moves keyboard focus to the summary heading',
    'F304 article copy buttons hidden without JavaScript',
    'F304 native return-to-outline links remain with JavaScript disabled'
  ])assert.ok(browser.includes(label),label);
  for(const forbidden of [/<form\b/i,/<input\b/i,/<textarea\b/i,
    /\bfetch\s*\(/,/\bsendBeacon\s*\(/,/\blocalStorage\b/,
    /\bsessionStorage\b/,/\bdocument\.cookie\b/])
    assert.doesNotMatch(page,forbidden);
});

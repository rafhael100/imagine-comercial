import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/pages/perguntas-frequentes.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F297 every FAQ topic has an in-page return to a focusable index heading',()=>{
  assert.match(page,/<h2 id="faq-index-heading" tabindex="-1">Encontre sua dúvida<\/h2>/);
  assert.match(page,/<p class="faq-back-index"><a href="#faq-index-heading">Voltar ao índice de perguntas<\/a><\/p>/);
  assert.match(page,/commercialFaqSections\.map\(\(section,index\)=>\(/);
  assert.match(page,/\.faq-back-index a\{display:inline-flex;align-items:center;min-height:44px/);
  assert.match(page,/\.faq-back-index a:focus-visible\{outline:3px solid #b45b00/);
});

test('F297 browser tests all four return links and keyboard focus',()=>{
  assert.match(browser,/F297 every FAQ topic offers an index return/);
  assert.match(browser,/F297 return link transfers focus to the FAQ index heading/);
  for(const forbidden of [/<form\b/i,/\bfetch\s*\(/,/\bsendBeacon\s*\(/,
    /\bXMLHttpRequest\b/,/\blocalStorage\b/,/\bsessionStorage\b/,
    /\bdocument\.cookie\b/])
    assert.doesNotMatch(page,forbidden);
});

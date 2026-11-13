import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {commercialFaqSections} from '../src/data/commercial-faq.mjs';
const page=readFileSync(new URL('../src/pages/perguntas-frequentes.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F300 copy controls exist exactly for the reviewed eight FAQ answers',()=>{
  const ids=commercialFaqSections.flatMap(s=>s.questions.map(q=>q.id));
  assert.equal(ids.length,8);
  assert.equal(new Set(ids).size,8);
  assert.match(page,/data-faq-copy={item\.id}/);
  assert.match(page,/aria-label={'Copiar link da resposta: '\+item\.question}/);
  assert.match(page,/<span role="status" aria-live="polite" aria-atomic="true"\s+data-faq-copy-status>/);
  assert.match(page,/const anchor='duvida-'\+button\.dataset\.faqCopy/);
  assert.match(page,/if\(!approved\.has\(anchor\)\|\|!region\|\|!feedback\)continue/);
  assert.match(page,/const href=window\.location\.origin\+'\/perguntas-frequentes\/#'\+anchor/);
  assert.match(page,/navigator\.clipboard\.writeText\(href\)/);
});

test('F300 native FAQ reading remains usable with JS off, without PII capture',()=>{
  assert.match(page,/if\(navigator\.clipboard\?\.writeText\)\{/);
  assert.match(page,/class="faq-copy-row" data-faq-share hidden/);
  assert.match(page,/\.faq-copy-row\[hidden\]\{display:none!important\}/);
  assert.match(page,/\.faq-copy-row button\{min-height:44px/);
  assert.match(page,/\.faq-copy-row button:focus-visible\{outline:3px solid #b45b00/);
  assert.match(browser,/F300 copied FAQ address contains no search or private information/);
  assert.match(browser,/F300 FAQ copy controls hidden without JS/);
  assert.match(browser,/F300 no-JS FAQ answers remain available/);
  for(const forbidden of [/<form\b/i,/<input\b/i,/<textarea\b/i,
    /\bfetch\s*\(/,/\blocalStorage\b/,/\bsessionStorage\b/,
    /\bdocument\.cookie\b/])
    assert.doesNotMatch(page,forbidden);
});

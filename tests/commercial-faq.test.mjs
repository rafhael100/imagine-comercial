import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sitePages} from '../src/data/services.mjs';
import {commercialFaqSections} from '../src/data/commercial-faq.mjs';

const file=readFileSync(new URL('../src/pages/perguntas-frequentes.astro',import.meta.url),'utf8');
test('F65 FAQ catalog has four categories, eight unique questions and answers',()=>{
 assert.equal(commercialFaqSections.length,4);
 const questions=commercialFaqSections.flatMap(section=>section.questions);
 assert.equal(questions.length,8);
 assert.equal(new Set(questions.map(x=>x.id)).size,8);
 for(const section of commercialFaqSections){
  assert.ok(Object.isFrozen(section)&&Object.isFrozen(section.questions));
  assert.equal(section.questions.length,2);
  for(const item of section.questions){
   assert.ok(Object.isFrozen(item));
   assert.ok(item.question.length>30&&item.question.endsWith('?'));
   assert.ok(item.answer.length>90);
   assert.doesNotMatch(item.answer,/\bR\$\s*\d|garantimos vendas|garantimos posicionamento|prazo de \d+ dias/i);
  }
 }
});
test('F65 route is indexable, static and has no visitors data collection',()=>{
 assert.ok(sitePages.some(x=>x.path==='/perguntas-frequentes/'));
 assert.match(file,/commercialFaqSections\.map/);
 assert.match(file,/<details class="faq-item">/);
 assert.match(file,/<summary>/);
 assert.match(file,/href="\/contato\/"/);
 assert.match(file,/href="\/como-funciona\/"/);
 assert.match(file,/href="\/comparar-solucoes\/"/);
 assert.doesNotMatch(file,/<form\b|<input\b|<script\b|fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie/);
});

test('F189 eight canonical question anchors and four topic links, no personal state',()=>{
 const ids=commercialFaqSections.flatMap(section=>section.questions.map(item=>item.id));
 assert.equal(new Set(ids).size,8);
 assert.match(file,/aria-label="Índice de perguntas frequentes"/);
 assert.match(file,/href={'#faq-'\+section\.code}/);
 assert.match(file,/href={'#duvida-'\+item\.id}/);
 assert.match(file,/id={'duvida-'\+item\.id}/);
 assert.match(file,/class="faq-entry"/);
 assert.doesNotMatch(file,/localStorage|sessionStorage|document\.cookie|fetch\(/);
});

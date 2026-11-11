import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sitePages} from '../src/data/services.mjs';
import {processStages,preparationQuestions} from '../src/data/commercial-process.mjs';

const page=readFileSync(new URL('../src/pages/como-funciona.astro',import.meta.url),'utf8');
test('F64 public process has six distinct, reviewed stages and briefing questions',()=>{
 assert.equal(processStages.length,6);
 assert.equal(preparationQuestions.length,6);
 assert.equal(new Set(processStages.map(s=>s.key)).size,6);
 for(const step of processStages){
  assert.ok(Object.isFrozen(step));
  assert.match(step.key,/^[a-z-]+$/);
  assert.ok(step.title.length>=15&&step.summary.length>65&&step.confirmation.endsWith('?'));
  assert.doesNotMatch(step.summary,/\bR\$\s*\d+|garantimos|prazo fixo|desconto garantido/i);
 }
});
test('F64 route and public links are in canonical inventory and no external/PII transport exists',()=>{
 assert.ok(sitePages.some(p=>p.path==='/como-funciona/'));
 assert.match(page,/pathname=\{pathname\}/);
 assert.match(page,/processStages\.map/);
 assert.match(page,/preparationQuestions\.map/);
 assert.match(page,/<ol class="process-list">/);
 assert.match(page,/<li class="process-card">/);
 assert.match(page,/href="#etapas"/);
 assert.match(page,/href="\/comparar-solucoes\/"/);
 assert.match(page,/href="\/contato\/"/);
 assert.match(page,/Não envie senhas/);
 assert.doesNotMatch(page,/<form\b|<input\b|<script\b[^>]*src=|fetch\(|localStorage|sessionStorage|document\.cookie|innerHTML|https?:\/\//);
 assert.match(page,/print\.addEventListener\('click',\(\)=>window\.print\(\)\)/);
 assert.match(page,/data-briefing-task/);
});

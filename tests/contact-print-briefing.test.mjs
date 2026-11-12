import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F249 print is explicit and unavailable without script',()=>{
  assert.match(source,/<button class="cta cta-secondary contact-print" type="button" id="print-briefing" hidden/);
  assert.match(source,/typeof window\.print==='function'/);
  assert.match(source,/printButton\.addEventListener\('click',\(\)=>window\.print\(\)\)/);
  assert.match(source,/\.contact-print\[hidden\]\{display:none!important\}/);
  assert.match(qa,/F249 print never runs without click/);
  assert.match(qa,/F249 print only on intentional click/);
});
test('F249 printable summary contains only curated labels with no editable or submitted input',()=>{
  assert.match(source,/id="print-briefing-summary" class="print-briefing-summary"/);
  for(const key of ['service','objective','stage','priority','message'])
    assert.ok(source.includes('id="print-briefing-'+key+'"'));
  assert.match(source,/printService\.textContent=label\|\|'Ainda quero orientação'/);
  assert.match(source,/printObjective\.textContent=objective\.selectedOptions/);
  assert.match(source,/printStage\.textContent=stage\.selectedOptions/);
  assert.match(source,/printPriority\.textContent=priority\.selectedOptions/);
  assert.match(source,/printMessage\.textContent=whatsappMessage/);
  assert.match(source,/Nenhum pedido foi enviado pelo site/);
  assert.doesNotMatch(source,/<form\b|<input\b|<textarea\b|fetch\s*\(|localStorage|sessionStorage|sendBeacon|document\.cookie/);
});
test('F249 print CSS hides navigation, screen continues showing regular contact options',()=>{
  assert.match(source,/@media print/);
  assert.match(source,/:global\(header\),:global\(footer\),:global\(main#conteudo > :not\(\.hero\)\)/);
  assert.match(source,/\.hero>\.shell>:not\(\.print-briefing-summary\)\{display:none!important\}/);
  assert.match(source,/\.print-briefing-summary\{display:block!important/);
  assert.match(qa,/F249 summary stays print-only on screen/);
  assert.match(qa,/F249 printable summary visible in print media/);
  assert.match(qa,/F249 print layout excludes external actions/);
});

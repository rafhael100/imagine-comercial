import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const faq=readFileSync(new URL('../src/pages/perguntas-frequentes.astro',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F261 repeated FAQ index anchor opens approved answer without relying on hashchange',()=>{
  assert.match(faq,/function openApprovedAnswer\(anchor:string\)/);
  assert.match(faq,/if\(!approved\.has\(anchor\)\)return;/);
  assert.match(faq,/const id=link\.getAttribute\('href'\)\?\.slice\(1\)\|\|'';/);
  assert.match(faq,/openApprovedAnswer\(id\);/);
  assert.match(faq,/const reveal=\(\)=>openApprovedAnswer\(window\.location\.hash\.slice\(1\)\);/);
  assert.match(faq,/if\(answer\)answer\.open=true;/);
  assert.doesNotMatch(faq,/fetch\s*\(|localStorage|sessionStorage|document\.cookie/);
});

test('F261 browser QA covers repeated unchanged fragment after hiding answer',()=>{
  assert.match(qa,/F261 repeated FAQ anchor keeps same URL/);
  assert.match(qa,/F261 same-hash FAQ link reopens the collapsed answer/);
  assert.match(qa,/F261 repeated FAQ link also restores hidden topics/);
  assert.match(qa,/F261 index navigation resets filter button state/);
});

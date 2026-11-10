import test from 'node:test';
import assert from 'node:assert/strict';
import {guideGoals,guideForGoal} from '../src/lib/public-service-guide.mjs';
import {services} from '../src/data/services.mjs';
import {readFileSync} from 'node:fs';

const codes=['apresentar','detalhar','oferta','continuidade','anuncios'];
const slugs=new Set(services.map(item=>item.slug));
test('F58 all public service goals are fixed, non-overlapping and complete',()=>{
  assert.deepEqual(guideGoals.map(item=>item.code),codes);
  assert.equal(new Set(guideGoals.flatMap(item=>item.slugs)).size,services.length);
  assert.deepEqual(guideGoals.flatMap(item=>item.slugs).sort(),[...slugs].sort());
  for(const item of guideGoals){
    assert.ok(Object.isFrozen(item));
    assert.ok(Object.isFrozen(item.slugs));
    assert.ok(item.goal.length>10);
    assert.ok(item.explanation.length>40);
  }
});
test('F58 guide produces only local reviewed service URLs, never prices or authority',()=>{
  for(const code of codes){
    const chosen=guideForGoal(code);
    assert.equal(chosen.code,code);
    assert.ok(Object.isFrozen(chosen));
    assert.ok(Object.isFrozen(chosen.services));
    assert.ok(chosen.services.length===1||chosen.services.length===2);
    assert.ok(!/garantid[oa]|\bR\$\b|autoriza|contratar agora/i.test(chosen.explanation));
    for(const item of chosen.services){
      assert.ok(slugs.has(item.slug));
      assert.equal(item.href,'/servicos/'+item.slug+'/');
      assert.equal(item.label,services.find(s=>s.slug===item.slug).label);
      assert.ok(Object.isFrozen(item));
    }
  }
});
test('F58 rejects unknown or untrusted choices without echoing their value',()=>{
  for(const input of ['','INVALID','__proto__','constructor','toString',
    'https://example.com','gestao-google-ads',{code:'apresentar'},null,42,
    'apresentar\n<script>']){
    assert.throws(()=>guideForGoal(input),/^Error: Invalid public service guide goal$/);
  }
});
test('F58 browser-only UI does not create a form, external transport or HTML injection',()=>{
  const page=readFileSync(new URL('../src/pages/servicos/index.astro',import.meta.url),'utf8');
  assert.match(page,/id="service-guide-goal"/);
  assert.match(page,/id="service-guide-results"/);
  assert.match(page,/aria-live="polite"/);
  assert.match(page,/guideForGoal/);
  assert.match(page,/replaceChildren/);
  assert.match(page,/textContent/);
  assert.doesNotMatch(page,/<form\b|<input\b|fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|innerHTML|document\.cookie/);
});

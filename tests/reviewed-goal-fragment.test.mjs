import test from 'node:test';
import assert from 'node:assert/strict';
import {guideGoals} from '../src/lib/public-service-guide.mjs';
import {encodeReviewedGoalFragment as encode,decodeReviewedGoalFragment as decode}
  from '../src/data/reviewed-goal-fragment.mjs';
import {readFileSync} from 'node:fs';

test('F196 all five curated goals round trip to a canonical, public-only fragment',()=>{
  assert.equal(guideGoals.length,5);
  const seen=new Set();
  for(const goal of guideGoals){
    const hash=encode(goal.code);
    assert.equal(decode(hash),goal.code);
    assert.match(hash,/^#objetivo:[a-z-]+$/);
    assert.ok(hash.length<60);
    seen.add(hash);
  }
  assert.equal(seen.size,5);
});
test('F196 fabricated, encoded and personally identifying hashes fail closed',()=>{
  for(const x of [null,1,{},'', '#objetivo:', '#objetivo:__proto__',
    '#objetivo:oferta:extra','#objetivo:%6fferta',
    '#objetivo:oferta?email=test@example.invalid','#objetivo:ANUNCIOS',
    '#objetivo:oferta'.repeat(10)])assert.equal(decode(x),null);
  for(const x of [null,42,{},'', '__proto__','oferta?utm=test','anuncios/private'])
    assert.throws(()=>encode(x),/unreviewed public goal/);
});
test('F196 page links restore local-only objective without collecting visitors',()=>{
  const home=readFileSync(new URL('../src/pages/index.astro',import.meta.url),'utf8');
  const directory=readFileSync(new URL('../src/pages/servicos/index.astro',import.meta.url),'utf8');
  assert.match(home,/data-goal-deeplink/);
  assert.match(home,/encodeReviewedGoalFragment\(goal\.code\)/);
  assert.match(directory,/decodeReviewedGoalFragment\(window\.location\.hash\)/);
  assert.match(directory,/history\.replaceState/);
  assert.match(directory,/<noscript>/);
  assert.match(directory,/Sem JavaScript, o objetivo vindo de outro link não atualiza este guia/);
  assert.doesNotMatch(home+directory,/<form\b|<input\b|fetch\s*\(|localStorage|sessionStorage|sendBeacon/);
});

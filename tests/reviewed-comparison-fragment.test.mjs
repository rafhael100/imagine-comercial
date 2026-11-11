import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {comparisonOptions} from '../src/data/service-comparison.mjs';
import {
  encodeReviewedComparisonFragment as encode,
  decodeReviewedComparisonFragment as decode
} from '../src/data/reviewed-comparison-fragment.mjs';

test('F175 all 15 unordered pairs round trip to one canonical public hash each',()=>{
  const all=new Set();
  for(let i=0;i<comparisonOptions.length;i++)
    for(let j=i+1;j<comparisonOptions.length;j++){
      const a=comparisonOptions[i].slug,b=comparisonOptions[j].slug;
      const hash=encode([a,b]);
      assert.equal(hash,encode([b,a]),'pair order does not change link');
      assert.deepEqual(decode(hash),[a,b]);
      assert.ok(Object.isFrozen(decode(hash)));
      assert.match(hash,/^#comparar:[a-z0-9-]+:[a-z0-9-]+$/);
      assert.ok(hash.length<90);
      all.add(hash);
    }
  assert.equal(all.size,15);
});
test('F175 malformed, forged, duplicate or unreviewed fragments cannot restore comparison',()=>{
  for(const hash of ['',null,undefined,42,{},'#comparar:',
    '#comparar:onepage', '#comparar:onepage:onepage',
    '#comparar:landing-pages:onepage', // not canonical order
    '#comparar:onepage:landing-pages:extra',
    '#comparar:onepage:%6canding-pages',
    '#comparar:onepage:CPF-999', '#comparar:onepage:a@b.invalid',
    '#comparar:onepage:landing-pages?email=example.invalid',
    '#comparar:onepage:landing-pages'.repeat(20)])
    assert.equal(decode(hash),null,'reject '+String(hash).slice(0,60));
  for(const pair of [[],['onepage'],['onepage','onepage'],
    ['onepage','invalid'],['onepage','landing-pages','extra'],
    ['onepage',{}],null,{}])
    assert.throws(()=>encode(pair),/exactly two different approved/);
});
test('F175 share action uses only reviewed options and strips current URL query',()=>{
  const page=readFileSync(new URL('../src/pages/comparar-solucoes.astro',import.meta.url),'utf8');
  const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');
  assert.match(page,/id="copy-comparison-link"[^>]*hidden/);
  assert.match(page,/decodeReviewedComparisonFragment\(window\.location\.hash\)/);
  assert.match(page,/window\.location\.origin\+'\/comparar-solucoes\/'\+fragment/);
  assert.match(page,/share\.addEventListener\('click',async\(\)=>/);
  assert.match(page,/window\.addEventListener\('hashchange',applyFragment\)/);
  assert.match(page,/window\.addEventListener\('popstate',applyFragment\)/);
  assert.match(page,/const ticket=\+\+revision;/);
  assert.match(page,/if\(ticket===revision\)/);
  for(const scenario of [
    'F175 valid two-service link restores comparison after reload',
    'F175 malformed comparison fragments must fail closed',
    'F175 share link stays hidden without JavaScript'
  ])assert.ok(browser.includes(scenario),scenario);
  assert.doesNotMatch(page,/<form\b|<input\b|<textarea\b|fetch\s*\(|localStorage|sessionStorage|document\.cookie|innerHTML/);
});

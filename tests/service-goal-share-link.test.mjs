import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {guideGoals} from '../src/lib/public-service-guide.mjs';
import {encodeReviewedGoalFragment}
  from '../src/data/reviewed-goal-fragment.mjs';

const page=readFileSync(new URL('../src/pages/servicos/index.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F299 copied guidance link is made only from approved public goal codes',()=>{
  assert.equal(guideGoals.length,5);
  for(const item of guideGoals){
    const fragment=encodeReviewedGoalFragment(item.code);
    assert.match(fragment,/^#objetivo:[a-z-]+$/);
    assert.ok(fragment.length<60);
  }
  assert.match(page,/const link=window\.location\.origin\+'\/servicos\/'\+\s+encodeReviewedGoalFragment\(selector\.value\)/);
  assert.doesNotMatch(page,/window\.location\.href|window\.location\.search\s*\+/);
  assert.match(page,/navigator\.clipboard\.writeText\(link\)/);
  assert.match(page,/const ticket=\+\+clipboardRevision/);
  assert.match(page,/if\(ticket===clipboardRevision\)/);
  assert.match(page,/const renderGuide=\(\)=>\{\s+clipboardRevision\+\+;/);
});

test('F299 copy action is user-controlled, accessible and absent without clipboard/JS',()=>{
  assert.match(page,/<button id="copy-goal-link"[^>]*type="button" hidden/);
  assert.match(page,/aria-describedby="service-guide-explanation"/);
  assert.match(page,/<p id="copy-goal-status" role="status" aria-live="polite" aria-atomic="true"><\/p>/);
  assert.match(page,/copyGoal\.hidden=false/);
  assert.match(page,/\.service-guide-share button\[hidden\]\{display:none!important\}/);
  assert.match(browser,/F299 clipboard contains only approved shareable goal URL/);
  assert.match(browser,/F299 goal change clears copied-link confirmation/);
  assert.match(browser,/F299 clipboard enhancement remains hidden without JS/);
  for(const forbidden of [/<form\b/i,/<input\b/i,/<textarea\b/i,
    /\bfetch\s*\(/,/\blocalStorage\b/,/\bsessionStorage\b/,
    /\bsendBeacon\s*\(/,/\bdocument\.cookie\b/])
    assert.doesNotMatch(page,forbidden);
});

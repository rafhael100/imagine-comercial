import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const contact=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
const browser=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');

test('F173 copy and share both enforce one in-flight clipboard action',()=>{
  assert.match(contact,/let clipboardRevision=0;/);
  assert.match(contact,/let clipboardPending=false;/);
  assert.match(contact,/copy\.disabled=pending;/);
  assert.match(contact,/share\.disabled=pending;/);
  assert.equal((contact.match(/if \(clipboardPending\) return;/g)||[]).length,2);
  assert.equal((contact.match(/setClipboardPending\(true\);/g)||[]).length,2);
  assert.equal((contact.match(/setClipboardPending\(false\);/g)||[]).length,2);
});
test('F173 all choices invalidate any pending clipboard confirmation',()=>{
  assert.match(contact,/const update = \(\) => \{\s+clipboardRevision\+\+;/);
  for(const change of [
    "objective.addEventListener('change', update)",
    "stage.addEventListener('change', update)",
    "priority.addEventListener('change', update)",
    "window.addEventListener('hashchange', applyFragment)",
    "window.addEventListener('popstate', applyFragment)"
  ])assert.ok(contact.includes(change),change);
  assert.equal((contact.match(/const ticket=\+\+clipboardRevision;/g)||[]).length,2);
  assert.equal((contact.match(/if \(ticket===clipboardRevision\) /g)||[]).length,4);
});
test('F173 Chromium verifies real promise race, no-JS fallback remains',()=>{
  for(const text of [
    'F173 prevent concurrent message writes',
    'F173 prevent concurrent link writes',
    'F173 stale clipboard success must not confirm changed briefing',
    'F173 old copy failure must not obscure new briefing',
    'F173 current choice gets valid confirmation',
    'F151 copy action stays hidden without JavaScript',
    'F169 share action stays hidden without JavaScript'
  ])assert.ok(browser.includes(text),text);
  assert.match(contact,/<button[^>]*id="copy-message" hidden/);
  assert.match(contact,/<button[^>]*id="copy-briefing-link" hidden/);
  assert.doesNotMatch(contact,/<form\b|<input\b|<textarea\b|fetch\s*\(|sendBeacon\s*\(|localStorage|sessionStorage|document\.cookie/);
});

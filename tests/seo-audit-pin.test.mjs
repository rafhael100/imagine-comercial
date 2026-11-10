import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/validate.yml',import.meta.url),'utf8');

test('SEO auditor is pinned to a reviewed SHA, not a moving branch',()=>{
  const match=workflow.match(/repository: rafhael100\/imagine-seo-engine\s+ref: ([a-f0-9]{40})/);
  assert.ok(match,'Expected exact independent SEO Engine commit');
  assert.equal(match[1],'8ddbd79cc42cb821f0d8fb1770b3cba588ba08e2');
});
test('Commercial CI fails on any technical SEO warnings including orphan pages',()=>{
  assert.ok(workflow.includes('audit-dist.mjs dist https://imaginecomunicacao.com.br/ --fail-on-warnings'));
});

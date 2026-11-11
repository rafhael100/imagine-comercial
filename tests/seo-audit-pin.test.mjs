import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/validate.yml',import.meta.url),'utf8');

test('SEO auditor is pinned to a reviewed SHA, not a moving branch',()=>{
  const match=workflow.match(/repository: rafhael100\/imagine-seo-engine\s+ref: ([a-f0-9]{40})/);
  assert.ok(match,'Expected exact independent SEO Engine commit');
  assert.equal(match[1],'e1ab006d74ff5be8e14362d01a2db77f917f1bf8');
});
test('Commercial CI fails on any technical SEO warnings including orphan pages',()=>{
  assert.ok(workflow.includes('audit-dist.mjs dist https://imaginecomunicacao.com.br/ --fail-on-warnings'));
});


test('F56 SEO RC10 checks real public head metadata and fails on warnings',()=>{
  assert.ok(workflow.includes('audit-dist.mjs dist https://imaginecomunicacao.com.br/ --fail-on-warnings --strict-public-head'));
});

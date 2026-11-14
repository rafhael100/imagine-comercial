import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/validate.yml',import.meta.url),'utf8');

test('SEO auditor is pinned to a reviewed SHA, not a moving branch',()=>{
  const match=workflow.match(/repository: rafhael100\/imagine-seo-engine\s+ref: ([a-f0-9]{40})/);
  assert.ok(match,'Expected exact independent SEO Engine commit');
  assert.equal(match[1],'24ef49cab48f027d02b6680422643a8309271e14');
});
test('Commercial CI fails on any technical SEO warnings including orphan pages',()=>{
  assert.ok(workflow.includes('audit-dist.mjs dist https://imaginecomunicacao.com.br/ --fail-on-warnings'));
});


test('F56 SEO RC10 checks real public head metadata and fails on warnings',()=>{
  assert.ok(workflow.includes('audit-dist.mjs dist https://imaginecomunicacao.com.br/ --fail-on-warnings --strict-public-head'));
});

test('International routes are audited for reciprocal hreflang, not skipped',()=>{
  assert.match(workflow,/--multilingual --check-hreflang/);
});

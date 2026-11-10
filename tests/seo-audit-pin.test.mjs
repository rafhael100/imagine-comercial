import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/validate.yml',import.meta.url),'utf8');

test('SEO auditor is pinned to a reviewed SHA, not a moving branch',()=>{
  const match=workflow.match(/repository: rafhael100\/imagine-seo-engine\s+ref: ([a-f0-9]{40})/);
  assert.ok(match,'Expected exact independent SEO Engine commit');
  assert.equal(match[1],'ecb21585e55c0341d478bd46414e063f87deb5cf');
});
test('Commercial CI fails on any technical SEO warnings including orphan pages',()=>{
  assert.ok(workflow.includes('audit-dist.mjs dist https://imaginecomunicacao.com.br/ --fail-on-warnings'));
});

test('Public commercial routes enforce strict canonical Open Graph and robots metadata',()=>{
  assert.ok(workflow.includes('--fail-on-warnings --strict-public-head'));
});

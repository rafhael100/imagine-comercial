import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=path=>readFileSync(new URL('../.github/workflows/'+path,import.meta.url),'utf8');

test('F158 browser QA installs Chromium without mutable or unreachable apt deps',()=>{
  for(const path of ['validate.yml','commercial-lighthouse-lab.yml']){
    const ci=workflow(path);
    assert.match(ci,/run: npx playwright install chromium/);
    assert.doesNotMatch(ci,/playwright install --with-deps|apt(?:-get)? install|sudo apt/i);
    assert.match(ci,/node-version: '22'/);
    assert.match(ci,/run: npm ci --no-audit --no-fund/);
    assert.match(ci,/actions\/checkout@[0-9a-f]{40}/);
    assert.match(ci,/persist-credentials: false/);
  }
});
test('F158 Chromium test and Lighthouse audits are not bypassed',()=>{
  const ci=workflow('validate.yml');
  const lighthouse=workflow('commercial-lighthouse-lab.yml');
  assert.match(ci,/run: npm run test:browser/);
  assert.match(ci,/run: node scripts\/verify-dist\.mjs/);
  assert.match(lighthouse,/run: node scripts\/lighthouse-local-qa\.mjs/);
  const lighthouseScript=readFileSync(new URL('../scripts/lighthouse-local-qa.mjs',import.meta.url),'utf8');
  assert.match(lighthouseScript,/--output=json/);
});

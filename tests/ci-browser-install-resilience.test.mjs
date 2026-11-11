import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const yaml=readFileSync(new URL('../.github/workflows/validate.yml',import.meta.url),'utf8');

test('F161: browser remains mandatory but avoids apt-get DNS mirror dependency',()=>{
  assert.match(yaml,/run: npx playwright install chromium/);
  assert.doesNotMatch(yaml,/playwright install --with-deps/);
  assert.match(yaml,/run: npm run test:browser/);
  assert.match(yaml,/run: node scripts\/test-private-preview-browser-ci\.mjs/);
  assert.match(yaml,/run: node scripts\/test-private-budget-preview-browser-ci\.mjs/);
  assert.doesNotMatch(yaml,/continue-on-error:\s*true/);
  assert.doesNotMatch(yaml,/if:\s*always\(\)[^\n]*\n\s*run:\s*npm run test:browser/);
});

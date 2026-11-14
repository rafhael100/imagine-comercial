import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('P0-F178 browser tests a genuine signed challenge round trip without public submit',()=>{
  const code=read('scripts/test-private-budget-proof-browser-ci.mjs');
  assert.match(code,/chromium\.launch\(\{headless:true\}\)/);
  assert.match(code,/startPrivateBudgetReviewLab\(password,\{requireRequestProof:true\}\)/);
  assert.match(code,/requestProof:preview\.body\.requestProof/);
  assert.match(code,/code,'SIGNED_REQUEST_PROOF_REQUIRED_OR_USED'/);
  assert.match(code,/reasonCode,'ATOMIC_STORE_REQUIRED'/);
  assert.match(code,/form button\[type="submit"\]'\)\.isDisabled\(\)/);
  assert.match(code,/localStorage\.length,session:sessionStorage\.length/);
  assert.doesNotMatch(code,/sendBeacon|Google Analytics|wrangler deploy|docker|Production API/);
});
test('P0-F178 browser is mandatory in CI after real Chromium installation',()=>{
  const ci=read('.github/workflows/validate.yml');
  const installed=ci.indexOf('bash scripts/install-chromium-ci.sh');
  const source=ci.indexOf('node scripts/test-private-budget-proof-browser-ci.mjs');
  assert.ok(installed>0&&source>installed);
  assert.doesNotMatch(ci,/continue-on-error:\s*true/);
});
test('P0-F178 old F161 review remains optional, public site still cannot receive leads',()=>{
  const server=read('tests/fixtures/private-budget-http-review-harness.mjs');
  const publicContact=read('src/pages/contato.astro');
  const privatePreview=read('tests/fixtures/private-contact-form-preview.html');
  assert.match(server,/requireRequestProof=false/);
  assert.match(server,/if\(requireRequestProof\)/);
  assert.doesNotMatch(publicContact,/<form\b|<input\b|fetch\s*\(|request-proof/);
  assert.match(privatePreview,/<button type="submit" disabled/);
});

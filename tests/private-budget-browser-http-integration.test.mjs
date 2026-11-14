import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('P0-F162 QA uses real Chromium + private HTTP harness without enabling form submission',()=>{
  const script=read('scripts/test-private-budget-browser-http-ci.mjs');
  assert.match(script,/chromium\.launch\(\{headless:true\}\)/);
  assert.match(script,/startPrivateBudgetReviewLab\(password\)/);
  assert.match(script,/page\.route\(previewUrl,route=>route\.fulfill/);
  assert.match(script,/method:'POST'/);
  assert.match(script,/body:JSON\.stringify\(body\)/);
  assert.match(script,/form#private-budget-preview button\[type="submit"\]/);
  assert.match(script,/canAcknowledgeVisitor/);
  assert.match(script,/STALE_SNAPSHOT_RECONCILE/);
  assert.match(script,/INVALID_CONTACT_ROUTE/);
  assert.match(script,/LAB_DIAGNOSTIC_NOT_RECEIPT/);
  assert.doesNotMatch(script,/docker|wrangler|deploy|set-cookie|Google Analytics/);
});
test('P0-F162 public site remains without web intake or private review harness',()=>{
  const publicPage=read('src/pages/contato.astro');
  assert.doesNotMatch(publicPage,/<form\b|<textarea\b|<input\b|private-budget-http-review|fetch\s*\(/);
  const fixture=read('tests/fixtures/private-contact-form-preview.html');
  assert.match(fixture,/<button type="submit" disabled/);
  assert.doesNotMatch(fixture,/<script\b|\baction=|fetch\s*\(/);
});
test('P0-F162 browser HTTP bridge is a required CI step, after Chromium install',()=>{
  const ci=read('.github/workflows/validate.yml');
  const chromium=ci.indexOf('bash scripts/install-chromium-ci.sh');
  const browser=ci.indexOf('node scripts/test-private-budget-browser-http-ci.mjs');
  assert.ok(chromium>0&&browser>chromium);
  assert.doesNotMatch(ci,/continue-on-error:\s*true/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('P0-F180 signed budget HTTP accepts an injected nonce claim only in lab mode',()=>{
  const http=read('tests/fixtures/private-budget-http-review-harness.mjs');
  assert.match(http,/requireRequestProof=false,claimNonce=null/);
  assert.match(http,/claimNonce!==null&&\(!requireRequestProof\|\|typeof claimNonce!=='function'\)/);
  assert.match(http,/claimNonce:claimNonce\?\?/);
  assert.match(http,/let issuedCount=0;/);
  assert.match(http,/if\(issuedCount>=256\)/);
  assert.match(http,/if\(inspected\.oneTimeNonceClaimedInLab!==true\)/);
  assert.match(http,/LAB_DIAGNOSTIC_NOT_RECEIPT/);
});
test('P0-F180 real PostgreSQL test exclusively uses disposable CI and sanitized nonce/expiry',()=>{
  const code=read('scripts/test-budget-proof-http-postgres-ephemeral-ci.mjs');
  for(const guard of ["GITHUB_ACTIONS!=='true'",
    "RUNNER_ENVIRONMENT!=='github-hosted'",
    "IMAGINE_EPHEMERAL_PG_TEST!=='1'",
    "'PGHOST'","'PGPASSWORD'","'PGDATABASE'"])
    assert.ok(code.includes(guard),guard);
  assert.match(code,/CREATE SCHEMA /);
  assert.match(code,/ON CONFLICT \(nonce\) DO NOTHING RETURNING nonce/);
  assert.match(code,/requireRequestProof:true,claimNonce/);
  assert.match(code,/Array\.from\(\{length:8\}/);
  assert.match(code,/status,403|status,200|status,422/);
  assert.doesNotMatch(code,/DROP DATABASE|pg_dump|public HTTP endpoint|SET ROLE|wrangler deploy/);
});
test('P0-F180 pipeline executes after F179 in existing ephemeral DB',()=>{
  const ci=read('scripts/test-postgres-ephemeral-ci.sh');
  const a=ci.indexOf('node scripts/test-budget-proof-postgres-ephemeral-ci.mjs');
  const b=ci.indexOf('node scripts/test-budget-proof-http-postgres-ephemeral-ci.mjs');
  const c=ci.indexOf('npm ci --no-audit --no-fund');
  assert.ok(a>=0&&b>a&&c>b);
  assert.match(ci,/trap cleanup EXIT/);
  const contact=read('src/pages/contato.astro');
  assert.doesNotMatch(contact,/<form\b|<input\b|request-proof|fetch\s*\(/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../scripts/test-budget-proof-postgres-ephemeral-ci.mjs',import.meta.url),'utf8');
const ci=readFileSync(new URL('../scripts/test-postgres-ephemeral-ci.sh',import.meta.url),'utf8');

test('P0-F179 PostgreSQL budget proof refuses any production/external DB context',()=>{
  for(const env of ["GITHUB_ACTIONS!=='true'","RUNNER_ENVIRONMENT!=='github-hosted'",
    "IMAGINE_EPHEMERAL_PG_TEST!=='1'","'PGHOSTADDR'","'PGDATABASE'","'PGPASSWORD'"])
    assert.ok(script.includes(env),env);
  assert.match(script,/to_regclass\('/);
  assert.match(script,/CREATE SCHEMA /);
  assert.match(script,/ON CONFLICT \(nonce\) DO NOTHING RETURNING nonce/);
  assert.match(script,/Array\.from\(\{length:12\}/);
  assert.match(script,/claimed_nonce/);
  assert.match(script,/origin:'http:\/\/127\.0\.0\.1:5432'/);
  assert.doesNotMatch(script,/pg_dump|DROP SCHEMA|ALTER ROLE|SET ROLE|\/mnt\/|Leaseweb|fetch\(/);
});
test('P0-F179 executes only inside ephemeral PostgreSQL runner after F96 and before build',()=>{
  const f96=ci.indexOf('node scripts/test-lead-http-postgres-ephemeral-ci.mjs');
  const f179=ci.indexOf('node scripts/test-budget-proof-postgres-ephemeral-ci.mjs');
  const build=ci.indexOf('npm ci --no-audit');
  assert.ok(f96>=0&&f179>f96&&build>f179);
  assert.match(ci,/trap cleanup EXIT/);
  assert.match(ci,/database=imagine_comercial_ci/);
});

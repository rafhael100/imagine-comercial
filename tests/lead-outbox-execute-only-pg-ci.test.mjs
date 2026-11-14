import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./sql/lead-outbox-execute-only-claim-ephemeral.sql',import.meta.url),'utf8');
const script=readFileSync(new URL('../scripts/test-lead-outbox-execute-only-ephemeral-ci.sh',import.meta.url),'utf8');
const parent=readFileSync(new URL('../scripts/test-postgres-ephemeral-ci.sh',import.meta.url),'utf8');

test('F89: direct state mutations revoked, claim grants transactional and tenant fixed',()=>{
  assert.match(sql,/BEGIN;/);
  assert.match(sql,/REVOKE UPDATE\(state,claim_version,attempts,lease_until\)/);
  assert.match(sql,/SECURITY DEFINER/);
  assert.match(sql,/SET search_path = pg_catalog/);
  assert.match(sql,/CREATE FUNCTION imagine_comercial_lead_ci\.claim_lab_a/);
  assert.match(sql,/p_submission uuid/);
  assert.match(sql,/p_expected_version bigint/);
  assert.match(sql,/organization_reference='11111111-1111-4111-8111-111111111111'::uuid/);
  assert.match(sql,/claim_version=p_expected_version/);
  assert.match(sql,/attempts<3/);
  assert.match(sql,/REVOKE ALL ON FUNCTION imagine_comercial_lead_ci\.claim_lab_a\(uuid,bigint\)/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION imagine_comercial_lead_ci\.claim_lab_a\(uuid,bigint\)/);
  assert.match(sql,/TO imagine_comercial_lead_ci_worker_a;/);
  assert.doesNotMatch(sql,/\b(?:EXECUTE\s+.+\s+TO\s+PUBLIC|GRANT\s+.+\s+TO\s+imagine_comercial_lead_ci_worker_b|EXECUTE\s+.+\s+TO\s+imagine_comercial_lead_ci_worker_b)\b/i);
  assert.doesNotMatch(sql,/EXECUTE\s+format\s*\(|EXECUTE\s+p_|current_setting\s*\(|session_user\b/i);
});

test('F89: CI-only bounded tests reject worker forging, replay and tenant escalation',()=>{
  for(const env of ['GITHUB_ACTIONS','RUNNER_ENVIRONMENT','IMAGINE_EPHEMERAL_PG_TEST',
                    'PGHOST','PGHOSTADDR','PGSERVICE']){
    assert.ok(script.includes(env),env);
  }
  assert.match(script,/F89 refuses non-ephemeral PostgreSQL or external hosts/);
  assert.match(script,/F89 refuses existing claim function/);
  assert.match(script,/F89 worker bypassed execute-only grant/);
  assert.match(script,/F89 fixed-tenant function claimed another organization's submission/);
  assert.match(script,/F89 unauthorized tenant worker executed A-only function/);
  assert.match(script,/F89 execute-only concurrent claim had/);
  assert.match(script,/F89 stale retry won a guarded claim/);
  assert.match(script,/F89 execute-only function exceeded retry limit/);
  assert.match(script,/F89 worker reset exhausted attempt counter/);
  assert.match(script,/F89 exhausted event was not preserved in its original tenant/);
  assert.match(script,/F89 worker B could view tenant A metadata/);
  assert.match(parent,/bash scripts\/test-lead-outbox-execute-only-ephemeral-ci\.sh/);
  assert.doesNotMatch(script,/\b(?:curl|ssh|scp|wget|pg_dump|dropdb|createdb|psql\s+-h)\b/);
});

test('F89: function returns at most diagnostic version, not purported CRM delivery',()=>{
  assert.match(sql,/RETURNS bigint/);
  assert.match(sql,/RETURN next_version/);
  assert.doesNotMatch(sql,/\b(?:email|phone|message|consent|payload|delivery_receipt)\b/i);
  assert.match(script,/no delivery/i);
});

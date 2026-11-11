import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('./sql/lead-idempotency-ephemeral.sql',import.meta.url),'utf8');
const script=readFileSync(new URL('../scripts/test-lead-metadata-postgres-ephemeral-ci.sh',import.meta.url),'utf8');
const harness=readFileSync(new URL('../scripts/test-postgres-ephemeral-ci.sh',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/commercial-postgres-ephemeral-lab.yml',import.meta.url),'utf8');

test('F85: SQL fixture is separate from deploy migrations and contains only synthetic metadata',()=>{
  assert.match(sql,/CREATE SCHEMA imagine_comercial_lead_ci/);
  assert.match(sql,/organization_reference uuid NOT NULL/);
  assert.match(sql,/submission_reference uuid NOT NULL/);
  assert.match(sql,/binding_reference uuid NOT NULL/);
  assert.match(sql,/site_reference uuid NOT NULL/);
  assert.match(sql,/form_reference uuid NOT NULL/);
  assert.match(sql,/destination_reference uuid NOT NULL/);
  assert.match(sql,/PRIMARY KEY \(organization_reference,submission_reference\)/);
  assert.doesNotMatch(sql,/^\s*(?:name|email|phone|mobile|details|consent|message|cpf|cnpj)\s+(?:text|varchar|character)/im);
  assert.doesNotMatch(sql,/CREATE TABLE\s+(?!imagine_comercial_lead_ci\.metadata_ledger)/i);
});

test('F85: physical tenant boundary is role-fixed, FORCE RLS and denied by default',()=>{
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/FORCE ROW LEVEL SECURITY/);
  assert.match(sql,/NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/g);
  assert.match(sql,/REVOKE ALL ON imagine_comercial_lead_ci\.metadata_ledger FROM PUBLIC/);
  assert.match(sql,/GRANT UPDATE\(state,version\)/);
  assert.match(sql,/CREATE POLICY lab_a_fixed_organization/);
  assert.match(sql,/CREATE POLICY lab_b_fixed_organization/);
  assert.doesNotMatch(sql,/current_setting\s*\(|GRANT\s+(?:DELETE|TRUNCATE|ALL)\s+ON imagine_comercial_lead_ci\.metadata_ledger/i);
});

test('F85: PostgreSQL integration refuses external hosts and only runs on hosted disposable CI',()=>{
  for(const marker of ['GITHUB_ACTIONS','RUNNER_ENVIRONMENT','IMAGINE_EPHEMERAL_PG_TEST',
                       'PGHOST','PGHOSTADDR','PGSERVICE']){
    assert.ok(script.includes(marker),marker);
    assert.ok(harness.includes(marker),marker);
  }
  assert.match(harness,/refuses to reuse an existing database/);
  assert.match(harness,/bash scripts\/test-lead-metadata-postgres-ephemeral-ci\.sh/);
  assert.match(harness,/dropuser --if-exists imagine_comercial_lead_ci_a/);
  assert.match(harness,/dropuser --if-exists imagine_comercial_lead_ci_b/);
  assert.match(script,/tests\/sql\/lead-idempotency-ephemeral\.sql/);
  assert.match(workflow,/runs-on: ubuntu-24\.04/);
  assert.match(workflow,/IMAGINE_EPHEMERAL_PG_TEST: '1'/);
  assert.doesNotMatch(script,/\b(?:curl|ssh|scp|wget|pg_dump|dropdb|createdb|psql\s+-h)\b/);
});

test('F85: replay, concurrent CAS, pinned attributes and cross-tenant reads are probed',()=>{
  assert.match(script,/expected exactly one PostgreSQL CAS winner/);
  assert.match(script,/F85 forged-tenant INSERT succeeded/);
  assert.match(script,/F85 cross-tenant read was not isolated by RLS/);
  assert.match(script,/F85 tenant context could be spoofed/);
  assert.match(script,/F85 conflicting destination bypassed the unique key/);
  assert.match(script,/for column in organization_reference binding_reference site_reference form_reference destination_reference/);
  assert.match(script,/stale CAS replay changed the reservation/);
  assert.match(script,/SELECT count\(\*\) FROM information_schema\.columns/);
  assert.doesNotMatch(script,/imaginecomunicacao\.com\.br|crm\.imagine|https?:\/\//);
});

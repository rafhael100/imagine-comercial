import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./sql/lead-receipt-nonce-ephemeral.sql',import.meta.url),'utf8');
const script=readFileSync(new URL('../scripts/test-lead-receipt-nonce-ephemeral-ci.sh',import.meta.url),'utf8');
const parent=readFileSync(new URL('../scripts/test-postgres-ephemeral-ci.sh',import.meta.url),'utf8');

test('F91: receipt nonce ledger stores no PII, signature or authenticated receipt',()=>{
  assert.match(sql,/CREATE TABLE imagine_comercial_lead_ci\.receipt_nonce_ledger/);
  assert.match(sql,/PRIMARY KEY \(organization_reference,nonce\)/);
  assert.match(sql,/FOREIGN KEY \(organization_reference,submission_reference\)/);
  assert.match(sql,/observed_at timestamptz NOT NULL DEFAULT transaction_timestamp\(\)/);
  assert.doesNotMatch(sql,/\b(?:email|phone|contact_name|message|payload|consent|secret|signature|mac)\s+(?:text|varchar|character|jsonb|bytea)/i);
  assert.doesNotMatch(sql,/SECURITY DEFINER|CREATE TRIGGER|https?:\/\//i);
});

test('F91: database uniqueness requires fixed-role RLS and denies table mutation',()=>{
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/FORCE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON imagine_comercial_lead_ci\.receipt_nonce_ledger FROM PUBLIC/);
  assert.match(sql,/GRANT SELECT,INSERT ON imagine_comercial_lead_ci\.receipt_nonce_ledger/);
  assert.match(sql,/CREATE POLICY nonce_a_fixed_org/);
  assert.match(sql,/CREATE POLICY nonce_b_fixed_org/);
  assert.doesNotMatch(sql,/GRANT\s+(?:ALL|UPDATE|DELETE|TRUNCATE)\s+ON imagine_comercial_lead_ci\.receipt_nonce_ledger/i);
  assert.doesNotMatch(sql,/current_setting\s*\(/);
});

test('F91: fixture executes only inside existing, fresh GitHub-hosted disposable CI',()=>{
  for(const env of ['GITHUB_ACTIONS','RUNNER_ENVIRONMENT','IMAGINE_EPHEMERAL_PG_TEST',
                    'PGHOST','PGHOSTADDR','PGSERVICE']){
    assert.ok(script.includes(env),env);
  }
  assert.match(script,/F91 refuses external or non-ephemeral PostgreSQL/);
  assert.match(script,/F91 refuses to reuse an existing nonce ledger/);
  assert.match(script,/F91 requires the disposable F85 metadata ledger/);
  assert.match(script,/tests\/sql\/lead-receipt-nonce-ephemeral\.sql/);
  assert.match(parent,/bash scripts\/test-lead-receipt-nonce-ephemeral-ci\.sh/);
  assert.doesNotMatch(script,/\b(?:curl|ssh|scp|wget|pg_dump|dropdb|createdb|psql\s+-h)\b/);
});

test('F91: parallel nonce insert, changed submission and per-tenant separation are tested',()=>{
  for(const expected of [
    'expected one atomic nonce winner',
    'replay of identical nonce inserted another receipt marker',
    'conflicting submission reused a nonce within the tenant',
    'reused nonce modified its original pinned submission',
    'separate nonce should be accepted as another attempt, not another lead',
    'conflated anti-replay nonce with business idempotency',
    'nonce RLS leaked tenant A markers to tenant B',
    'independent tenant could not reserve its own nonce',
    'tenant B forged a nonce for tenant A',
    'spoofing an app tenant GUC changed nonce visibility',
    'receipt marker without a prior logical submission was accepted',
    'ingestion role has destructive nonce rights'
  ])assert.ok(script.includes(expected),expected);
  assert.match(script,/ON CONFLICT DO NOTHING RETURNING nonce/);
  assert.match(script,/No CRM receipt/);
});

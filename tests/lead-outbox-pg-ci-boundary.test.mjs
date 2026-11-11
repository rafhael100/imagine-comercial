import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('./sql/lead-outbox-ephemeral.sql',import.meta.url),'utf8');
const script=readFileSync(new URL('../scripts/test-lead-outbox-postgres-ephemeral-ci.sh',import.meta.url),'utf8');
const parent=readFileSync(new URL('../scripts/test-postgres-ephemeral-ci.sh',import.meta.url),'utf8');

test('F86: outbox stores only synthetic pending UUID metadata, never lead content',()=>{
  assert.match(sql,/CREATE TABLE imagine_comercial_lead_ci\.metadata_outbox/);
  assert.match(sql,/PRIMARY KEY \(organization_reference,submission_reference,event_kind\)/);
  assert.match(sql,/FOREIGN KEY \(organization_reference,submission_reference\)/);
  assert.match(sql,/CHECK \(event_kind = 'pending_review'\)/);
  assert.match(sql,/enqueued_at timestamptz NOT NULL DEFAULT transaction_timestamp\(\)/);
  assert.doesNotMatch(sql,/^\s*(?:name|email|phone|mobile|details|consent|message|cpf|cnpj|payload)\s+(?:text|varchar|character|jsonb)/im);
  assert.doesNotMatch(sql,/https?:\/\/|CREATE EXTENSION|CREATE TRIGGER|SECURITY DEFINER/i);
});

test('F86: event access requires RLS tenant roles and disallows modification rights',()=>{
  assert.match(sql,/ALTER TABLE imagine_comercial_lead_ci\.metadata_outbox ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/ALTER TABLE imagine_comercial_lead_ci\.metadata_outbox FORCE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON imagine_comercial_lead_ci\.metadata_outbox FROM PUBLIC/);
  assert.match(sql,/GRANT SELECT,INSERT ON imagine_comercial_lead_ci\.metadata_outbox/);
  assert.match(sql,/CREATE POLICY outbox_lab_a/);
  assert.match(sql,/CREATE POLICY outbox_lab_b/);
  assert.doesNotMatch(sql,/GRANT\s+(?:DELETE|UPDATE|TRUNCATE|ALL)\s+ON imagine_comercial_lead_ci\.metadata_outbox/i);
});

test('F86: independent PostgreSQL CI guard and only the disposable F85 schema may be used',()=>{
  for(const env of ['GITHUB_ACTIONS','RUNNER_ENVIRONMENT','IMAGINE_EPHEMERAL_PG_TEST',
                    'PGHOST','PGHOSTADDR','PGSERVICE']){
    assert.ok(script.includes(env),env);
  }
  assert.match(script,/requires F85's already-proven ephemeral schema/);
  assert.match(script,/refuses to reuse an existing outbox table/);
  assert.match(script,/tests\/sql\/lead-outbox-ephemeral\.sql/);
  assert.match(parent,/bash scripts\/test-lead-metadata-postgres-ephemeral-ci\.sh/);
  assert.match(parent,/bash scripts\/test-lead-outbox-postgres-ephemeral-ci\.sh/);
  assert.doesNotMatch(script,/\b(?:curl|ssh|scp|wget|dropdb|createdb|pg_dump|psql\s+-h)\b/);
});

test('F86: atomic reserve/outbox, rollback, duplicates and isolation have negative probes',()=>{
  assert.match(script,/WITH reserved AS \(/);
  assert.match(script,/RETURNING organization_reference,submission_reference/);
  assert.match(script,/F86 failed to roll back reservation after rejected event/);
  assert.match(script,/F86 expected one atomic pending-review event/);
  assert.match(script,/F86 retry enqueued the same logical event again/);
  assert.match(script,/F86 outbox RLS leaks across tenants/);
  assert.match(script,/F86 duplicate outbox event accepted/);
  assert.match(script,/F86 orphan event accepted without metadata ledger/);
  assert.match(script,/F86 cross-tenant forged event was allowed/);
  assert.match(script,/F86 application role has destructive or mutable outbox rights/);
  assert.match(script,/No CRM delivery/);
});

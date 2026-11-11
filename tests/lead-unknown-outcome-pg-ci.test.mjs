import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('./sql/lead-unknown-outcome-hold-ephemeral.sql',import.meta.url),'utf8');
const script=readFileSync(new URL('../scripts/test-lead-unknown-outcome-ephemeral-ci.sh',import.meta.url),'utf8');
const parent=readFileSync(new URL('../scripts/test-postgres-ephemeral-ci.sh',import.meta.url),'utf8');
const publicContact=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');

test('F92: ambiguous delivery is a metadata-only hold, never a CRM receipt',()=>{
  assert.match(sql,/CREATE TABLE imagine_comercial_lead_ci\.unknown_outcome_hold/);
  assert.match(sql,/PRIMARY KEY \(organization_reference,submission_reference\)/);
  assert.match(sql,/FOREIGN KEY \(organization_reference,submission_reference\)/);
  assert.match(sql,/observed_claim_version bigint NOT NULL CHECK \(observed_claim_version > 0\)/);
  assert.doesNotMatch(sql,/^\s*(?:name|email|phone|message|payload|consent|receipt|signature|secret)\s+(?:text|varchar|jsonb|bytea)/im);
  assert.doesNotMatch(sql,/https?:\/\//);
  assert.doesNotMatch(publicContact,/<form\b|<input\b|unknown-outcome-hold/i);
});

test('F92: no automatic retry after unknown outcome, even on expired lease',()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION imagine_comercial_lead_ci\.claim_lab_a/);
  assert.match(sql,/AND NOT EXISTS \(/);
  assert.match(sql,/FROM imagine_comercial_lead_ci\.unknown_outcome_hold AS h/);
  assert.match(sql,/h\.organization_reference=o\.organization_reference/);
  assert.match(sql,/h\.submission_reference=o\.submission_reference/);
  assert.match(sql,/p_expected_version/);
  assert.match(sql,/o\.attempts<3/);
  assert.match(script,/F92 unknown outcome led to unsafe automatic retry/);
  assert.match(script,/F92 hold blocked an unrelated logical submission/);
});

test('F92: only current worker and active fencing version can report uncertainty',()=>{
  assert.match(sql,/CREATE FUNCTION imagine_comercial_lead_ci\.note_unknown_lab_a/);
  assert.match(sql,/SET search_path=pg_catalog/);
  assert.match(sql,/SECURITY DEFINER/);
  assert.match(sql,/claim_version=p_claim_version/);
  assert.match(sql,/lease_until > transaction_timestamp\(\)/);
  assert.match(sql,/REVOKE ALL ON FUNCTION imagine_comercial_lead_ci\.note_unknown_lab_a\(uuid,bigint\)/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION imagine_comercial_lead_ci\.note_unknown_lab_a\(uuid,bigint\)/);
  assert.match(script,/F92 allowed false unknown observation before a claim/);
  assert.match(script,/F92 wrong fencing version created unknown outcome/);
  assert.match(script,/F92 duplicate unknown claim was not idempotent/);
  assert.match(script,/F92 consumer B executed A-only unknown reporter/);
  assert.doesNotMatch(sql,/current_setting\s*\(|EXECUTE\s+format\s*\(/);
});

test('F92: RLS review-only table and ephemeral CI boundary are enforced',()=>{
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/FORCE ROW LEVEL SECURITY/);
  assert.match(sql,/GRANT SELECT ON imagine_comercial_lead_ci\.unknown_outcome_hold/);
  assert.match(sql,/CREATE POLICY unknown_hold_worker_a/);
  assert.match(sql,/CREATE POLICY unknown_hold_worker_b/);
  assert.doesNotMatch(sql,/GRANT\s+(?:INSERT|UPDATE|DELETE|TRUNCATE|ALL)\s+ON imagine_comercial_lead_ci\.unknown_outcome_hold/i);
  for(const marker of ['GITHUB_ACTIONS','RUNNER_ENVIRONMENT','IMAGINE_EPHEMERAL_PG_TEST','PGHOST','PGHOSTADDR','PGSERVICE'])
    assert.ok(script.includes(marker),marker);
  assert.match(script,/F92 refuses external or non-ephemeral PostgreSQL/);
  assert.match(script,/F92 refuses to reuse existing outcome hold/);
  assert.match(script,/F92 forged tenant GUC bypassed unknown-outcome RLS/);
  assert.match(script,/F92 consumer bypassed review-only hold privileges/);
  assert.match(parent,/bash scripts\/test-lead-unknown-outcome-ephemeral-ci\.sh/);
  assert.doesNotMatch(script,/\b(?:curl|ssh|scp|wget|pg_dump|dropdb|createdb|psql\s+-h)\b/);
});

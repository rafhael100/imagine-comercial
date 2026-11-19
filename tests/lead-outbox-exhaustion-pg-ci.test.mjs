import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('./sql/lead-outbox-exhaustion-review-ephemeral.sql',import.meta.url),'utf8');
const script=readFileSync(new URL('../scripts/test-lead-outbox-exhaustion-ephemeral-ci.sh',import.meta.url),'utf8');
const parent=readFileSync(new URL('../scripts/test-postgres-ephemeral-ci.sh',import.meta.url),'utf8');

test('F88: exhausted-lease review uses security invoker, barrier and no lead fields',()=>{
  assert.match(sql,/CREATE VIEW imagine_comercial_lead_ci\.exhausted_claim_review/);
  assert.match(sql,/security_invoker=true,security_barrier=true/);
  assert.match(sql,/state='claimed'/);
  assert.match(sql,/attempts>=3/);
  assert.match(sql,/lease_until < transaction_timestamp\(\)/);
  assert.match(sql,/REVOKE ALL ON imagine_comercial_lead_ci\.exhausted_claim_review FROM PUBLIC/);
  assert.match(sql,/GRANT SELECT ON imagine_comercial_lead_ci\.exhausted_claim_review/);
  assert.doesNotMatch(sql,/GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\s+ON imagine_comercial_lead_ci\.exhausted_claim_review/i);
  assert.doesNotMatch(sql,/\b(?:email|phone|name|message|consent|payload|access_token)\b/i);
});

test('F88: CI-only script repeats the F51 external-host and prior-state tripwires',()=>{
  for(const marker of ['GITHUB_ACTIONS','RUNNER_ENVIRONMENT','IMAGINE_EPHEMERAL_PG_TEST',
                       'PGHOST','PGHOSTADDR','PGSERVICE']){
    assert.ok(script.includes(marker),marker);
  }
  assert.match(script,/F88 refuses execution outside disposable GitHub-hosted/);
  assert.match(script,/F88 refuses to reuse an existing review view/);
  assert.match(script,/F88 requires the F86\/F87 disposable outbox/);
  assert.match(parent,/bash scripts\/test-lead-outbox-exhaustion-ephemeral-ci\.sh/);
  assert.match(script,/tests\/sql\/lead-outbox-exhaustion-review-ephemeral\.sql/);
  assert.doesNotMatch(script,/\b(?:curl|ssh|scp|wget|dropdb|createdb|pg_dump|psql\s+-h)\b/);
});

test('F88: three bounded attempts and crossed tenant review are real SQL tests',()=>{
  assert.match(script,/for expected in 0 1 2; do/);
  assert.match(script,/attempts<3/);
  assert.match(script,/F88 exhausted submission was auto-retried a fourth time/);
  assert.match(script,/F88 falsely marked an active lease as exhausted/);
  assert.match(script,/F88 did not preserve exhausted event for manual review/);
  assert.match(script,/F88 exhausted-event review leaked tenant data or missed the alert/);
  assert.match(script,/F88 review allowed GUC-based tenant spoofing/);
  assert.match(script,/F88 worker could rewrite review state through the view/);
  assert.match(script,/F88 expired lease forged successful reconciliation/);
  assert.match(script,/F88 worker role should not be able to read ingestion ledger/);
  assert.match(script,/no CRM delivery/i);
});

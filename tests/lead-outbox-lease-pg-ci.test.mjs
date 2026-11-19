import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('./sql/lead-outbox-lease-ephemeral.sql',import.meta.url),'utf8');
const script=readFileSync(new URL('../scripts/test-lead-outbox-lease-ephemeral-ci.sh',import.meta.url),'utf8');
const runner=readFileSync(new URL('../scripts/test-postgres-ephemeral-ci.sh',import.meta.url),'utf8');

test('F87: transient worker-only lease fields cannot carry lead PII or remote receipts',()=>{
  assert.match(sql,/ADD COLUMN state text NOT NULL DEFAULT 'queued'/);
  assert.match(sql,/ADD COLUMN claim_version bigint NOT NULL DEFAULT 0/);
  assert.match(sql,/ADD COLUMN attempts smallint NOT NULL DEFAULT 0/);
  assert.match(sql,/ADD COLUMN lease_until timestamptz/);
  assert.match(sql,/CHECK \(attempts >= 0 AND attempts <= 3\)/);
  assert.match(sql,/state IN \('queued','claimed','reconciled_lab'\)/);
  assert.doesNotMatch(sql,/ADD COLUMN\s+(?:email|phone|name|message|payload|consent|receipt|token|secret)\b/i);
  assert.doesNotMatch(sql,/CREATE EXTENSION|SECURITY DEFINER|https?:\/\/|CREATE TRIGGER/i);
});

test('F87: worker roles have tenant-scoped RLS with no write access to pinned metadata',()=>{
  assert.match(sql,/CREATE ROLE imagine_comercial_lead_ci_worker_a NOLOGIN [^\n]*NOBYPASSRLS/);
  assert.match(sql,/CREATE ROLE imagine_comercial_lead_ci_worker_b NOLOGIN [^\n]*NOBYPASSRLS/);
  assert.match(sql,/GRANT UPDATE \(state,claim_version,attempts,lease_until\)/);
  assert.match(sql,/CREATE POLICY outbox_worker_a/);
  assert.match(sql,/CREATE POLICY outbox_worker_b/);
  assert.match(sql,/organization_reference='11111111-1111-4111-8111-111111111111'/);
  assert.match(sql,/organization_reference='22222222-2222-4222-8222-222222222222'/);
  assert.doesNotMatch(sql,/GRANT\s+(?:DELETE|TRUNCATE|INSERT|ALL)\s+ON imagine_comercial_lead_ci\.metadata_outbox/i);
});

test('F87: only disposable hosted CI may create or remove fixture roles',()=>{
  for(const marker of ['GITHUB_ACTIONS','RUNNER_ENVIRONMENT','IMAGINE_EPHEMERAL_PG_TEST',
                       'PGHOST','PGHOSTADDR','PGSERVICE']){
    assert.ok(script.includes(marker),marker);
  }
  assert.match(script,/F87 refuses execution outside disposable GitHub-hosted/);
  assert.match(script,/F87 refuses to reuse worker roles/);
  assert.match(runner,/F87 refuses to reuse any reserved ephemeral CI role/);
  assert.match(runner,/dropuser --if-exists imagine_comercial_lead_ci_worker_a/);
  assert.match(runner,/dropuser --if-exists imagine_comercial_lead_ci_worker_b/);
  assert.match(runner,/bash scripts\/test-lead-outbox-lease-ephemeral-ci\.sh/);
  assert.match(script,/tests\/sql\/lead-outbox-lease-ephemeral\.sql/);
  assert.doesNotMatch(script,/\b(?:curl|ssh|scp|wget|pg_dump|dropdb|createdb|psql\s+-h)\b/);
});

test('F87: concurrent claims, crash reclaim, stale fencing and RLS are tested against real PostgreSQL',()=>{
  for(const error of [
    'expected precisely one claim winner',
    'duplicate claim succeeded during live lease',
    'cross-tenant worker read succeeded',
    'cross-tenant worker update succeeded',
    'worker could modify immutable column',
    'worker gained forbidden destructive or insertion rights',
    'expired lease was not reclaimed with a new fencing version',
    'stale worker forged reconciliation after lease recovery',
    'replay finalized an already-reconciled event'
  ])assert.ok(script.includes(error),error);
  assert.match(script,/lease_until < transaction_timestamp\(\)/);
  assert.match(script,/claim_version=1/);
  assert.match(script,/claim_version=2/);
  assert.match(script,/state='reconciled_lab'/);
  assert.match(script,/no CRM delivery/i);
});

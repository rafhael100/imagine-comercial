import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const script=readFileSync(new URL('../scripts/test-lead-http-postgres-ephemeral-ci.mjs',import.meta.url),'utf8');
const parent=readFileSync(new URL('../scripts/test-postgres-ephemeral-ci.sh',import.meta.url),'utf8');
const harness=readFileSync(new URL('./fixtures/private-loopback-intake-harness.mjs',import.meta.url),'utf8');
const contact=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');

test('F96: cannot run HTTP-to-PG integration outside disposable GitHub hosted CI',()=>{
  for(const name of [
    'GITHUB_ACTIONS','RUNNER_ENVIRONMENT','IMAGINE_EPHEMERAL_PG_TEST',
    'PGHOST','PGHOSTADDR','PGSERVICE','PGPORT','PGUSER','PGDATABASE','PGPASSWORD'
  ])assert.ok(script.includes(name),name);
  assert.match(script,/F96 refuses non-disposable CI or external DB/);
  assert.match(parent,/node scripts\/test-lead-http-postgres-ephemeral-ci\.mjs/);
  assert.match(harness,/server\.listen\(0,'127\.0\.0\.1'/);
  assert.doesNotMatch(script,/\b(?:ssh|scp|wget|pg_dump|dropdb|createdb|CREATE DATABASE|CREATE ROLE)\b/);
  assert.doesNotMatch(script,/0\.0\.0\.0|cloudflare\.com|leaseweb\.com|https?:\/\/(?!127\.0\.0\.1)/);
});

test('F96: HTTP metadata POST reserves in one PG statement with pending outbox',()=>{
  assert.match(script,/WITH created AS \(/);
  assert.match(script,/INSERT INTO \$\{schema\}\.metadata_ledger/);
  assert.match(script,/ON CONFLICT \(organization_reference,submission_reference\) DO NOTHING/);
  assert.match(script,/INSERT INTO \$\{schema\}\.metadata_outbox/);
  assert.match(script,/SELECT organization_reference,submission_reference,'pending_review' FROM created/);
  assert.match(script,/SELECT CASE WHEN EXISTS\(SELECT 1 FROM queued\)/);
  assert.match(script,/asLiteral\(body\.organization_reference\)/);
  assert.match(script,/F96 refuses unvalidated SQL reference/);
  assert.match(harness,/observeMetadata!==null/);
  assert.match(harness,/await observeMetadata\(body\)/);
  assert.match(harness,/LAB_METADATA_NOT_CONFIRMED/);
});

test('F96: two real HTTP requests still cannot certify durable CRM delivery',()=>{
  assert.match(script,/Promise\.all\(\[post\(h,envelope\),post\(h,envelope\)\]\)/);
  assert.match(script,/F96 expected one logical entry and one outbox event/);
  assert.match(script,/DUPLICATE_SYNTHETIC_METADATA/);
  assert.match(script,/FIRST_SYNTHETIC_METADATA_OBSERVATION/);
  assert.match(script,/tenantAuthenticatedForProduction/);
  assert.match(script,/crmPersisted/);
  assert.match(script,/visitorAcknowledgementAllowed/);
  assert.match(script,/deliveryProven/);
  assert.match(script,/METADATA_ENVELOPE_REJECTED/);
  assert.match(script,/SYNTHETIC_SERVICE_AUTH_REQUIRED/);
  assert.doesNotMatch(contact,/private-loopback-intake-harness|test-lead-http-postgres|<form\b|fetch\s*\(/);
});

test('F96: new PG integration stores only F78 synthetic UUID fields, no visitor payload',()=>{
  const columns=script.match(/asLiteral\(body\.[a-z_]+\)/g)||[];
  assert.deepEqual(columns.sort(),[
    'asLiteral(body.organization_reference)',
    'asLiteral(body.submission_reference)',
    'asLiteral(body.binding_reference)',
    'asLiteral(body.site_reference)',
    'asLiteral(body.form_reference)',
    'asLiteral(body.destination_reference)'
  ].sort());
  assert.ok(!script.includes('CREATE TABLE'));
  assert.ok(!script.includes("process.env.APP_URL"));
  assert.ok(!script.includes('console.log(envelope)'));
});

test('F148: unknown HTTP result after PG commit is held, replay has one outbox event',()=>{
  assert.match(script,/const unknownSubmission=/);
  assert.match(script,/const uncertainObserver=async body=>/);
  assert.match(script,/const outcome=await storeMetadata\(body\)/);
  assert.match(script,/return 'unknown'/);
  assert.match(script,/post\(h,unknownEnvelope\),503/);
  assert.match(script,/LAB_METADATA_NOT_CONFIRMED/);
  assert.match(script,/F148 committed metadata remains durable despite lost HTTP outcome/);
  assert.match(script,/DUPLICATE_SYNTHETIC_METADATA/);
  assert.match(script,/F148 retry must not create second event/);
  assert.match(harness,/crmPersisted:false/);
  assert.match(harness,/visitorAcknowledgementAllowed:false/);
});

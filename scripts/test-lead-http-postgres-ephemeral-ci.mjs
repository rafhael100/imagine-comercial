#!/usr/bin/env node
/**
 * F96 — PRIVATE CI integration: real loopback HTTP -> real disposable PG.
 * No production Portal/CRM, no visitor contacts, remote hosts or delivery ACK.
 */
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {startPrivateLoopbackIntakeHarness}
  from '../tests/fixtures/private-loopback-intake-harness.mjs';
const exec=promisify(execFile);
if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.RUNNER_ENVIRONMENT!=='github-hosted'||
   process.env.IMAGINE_EPHEMERAL_PG_TEST!=='1'||
   ['PGHOST','PGHOSTADDR','PGSERVICE','PGPORT','PGUSER','PGDATABASE','PGPASSWORD']
     .some(x=>process.env[x]))
  throw new Error('F96 refuses non-disposable CI or external DB');

const schema='imagine_comercial_lead_ci';
const tenant='11111111-1111-4111-8111-111111111111';
const submission='f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1';
// F148: uma segunda submissão exclusivamente sintética exercita resultado incerto.
const unknownSubmission='f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2';
const disconnectSubmission='f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3';
const envelope=Object.freeze({
  protocol:'imagine.lead-intake',schema_version:1,
  organization_reference:tenant,
  binding_reference:'22222222-2222-4222-8222-222222222222',
  submission_reference:submission,
  site_reference:'44444444-4444-4444-8444-444444444444',
  form_reference:'55555555-5555-4555-8555-555555555555',
  destination_reference:'66666666-6666-4666-8666-666666666666'
});
const unknownEnvelope=Object.freeze({...envelope,submission_reference:unknownSubmission});
const disconnectEnvelope=Object.freeze({...envelope,submission_reference:disconnectSubmission});
async function pg(sql){
  const {stdout}=await exec('sudo',[
    '-u','postgres','psql','-X','-q','-A','-t',
    '-v','ON_ERROR_STOP=1','-d','imagine_comercial_ci','-c',sql
  ],{timeout:15000,maxBuffer:128*1024});
  return stdout.trim();
}
const asLiteral=value=>{
  if(typeof value!=='string'||
     !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value))
    throw new Error('F96 refuses unvalidated SQL reference');
  return "'"+value.toLowerCase()+"'::uuid";
};
async function storeMetadata(body){
  // F95 checks exact eight-field F78 envelope and SERVER-FIXED binding.
  // Every value here is a validated UUID, not arbitrary input in SQL.
  const org=asLiteral(body.organization_reference);
  const sub=asLiteral(body.submission_reference);
  const binding=asLiteral(body.binding_reference);
  const site=asLiteral(body.site_reference);
  const form=asLiteral(body.form_reference);
  const destination=asLiteral(body.destination_reference);
  const outcome=await pg(`SET ROLE imagine_comercial_lead_ci_a;
    WITH created AS (
      INSERT INTO ${schema}.metadata_ledger
        (organization_reference,submission_reference,binding_reference,
         site_reference,form_reference,destination_reference)
      VALUES (${org},${sub},${binding},${site},${form},${destination})
      ON CONFLICT (organization_reference,submission_reference) DO NOTHING
      RETURNING organization_reference,submission_reference
    ), queued AS (
      INSERT INTO ${schema}.metadata_outbox
        (organization_reference,submission_reference,event_kind)
      SELECT organization_reference,submission_reference,'pending_review' FROM created
      RETURNING submission_reference
    )
    SELECT CASE WHEN EXISTS(SELECT 1 FROM queued)
      THEN 'new' ELSE 'duplicate' END;`);
  if(!['new','duplicate'].includes(outcome))
    throw new Error('F96 unknown database observation');
  return outcome;
}
function post(h,data,{auth=h.testOnlyBearer}={}){
  return fetch(h.url,{
    method:'POST',redirect:'error',
    headers:{
      'content-type':'application/json',
      ...(auth===null?{}:{authorization:'Bearer '+auth})
    },
    body:JSON.stringify(data)
  });
}
async function bodyOf(response,status=202){
  assert.equal(response.status,status);
  const value=await response.json();
  assert.equal(value.mode,'LAB_ONLY_VOLATILE_NO_CRM_DELIVERY');
  for(const key of [
    'crmPersisted','tenantAuthenticatedForProduction',
    'visitorAcknowledgementAllowed','deliveryProven'
  ])assert.equal(value[key],false,key);
  assert.ok(!JSON.stringify(value).includes(submission));
  return value;
}
async function run(){
  const before=await pg(`SELECT count(*) FROM ${schema}.metadata_ledger
    WHERE organization_reference=${asLiteral(tenant)}
      AND submission_reference=${asLiteral(submission)};`);
  assert.equal(before,'0','F96 requires unused synthetic submission');
  // A transação é executada primeiro; apenas a resposta ao HTTP é simulada
  // como perdida. Nunca declarar sucesso na ausência de resultado confiável.
  let loseFirstObservation=true;
  const uncertainObserver=async body=>{
    const outcome=await storeMetadata(body);
    if(body.submission_reference===unknownSubmission&&loseFirstObservation){
      loseFirstObservation=false;
      return 'unknown';
    }
    return outcome;
  };
  let disconnectOnce=true;
  const abortResponseAfterObservation=(body,observation)=>{
    if(body.submission_reference===disconnectSubmission&&disconnectOnce){
      assert.equal(observation.existed,false,
        'F149 only a first PostgreSQL observation may simulate a disconnect');
      disconnectOnce=false;
      return true;
    }
    return false;
  };
  const h=await startPrivateLoopbackIntakeHarness({
    observeMetadata:uncertainObserver,abortResponseAfterObservation
  });
  try{
    assert.match(h.url,/^http:\/\/127\.0\.0\.1:\d+\/__lab\/internal\/lead-review$/);
    const [x,y]=await Promise.all([post(h,envelope),post(h,envelope)]);
    const results=[await bodyOf(x),await bodyOf(y)];
    assert.deepEqual(results.map(r=>r.reasonCode).sort(),[
      'DUPLICATE_SYNTHETIC_METADATA',
      'FIRST_SYNTHETIC_METADATA_OBSERVATION'
    ]);
    assert.equal((await bodyOf(await post(h,envelope))).reasonCode,
      'DUPLICATE_SYNTHETIC_METADATA');
    const counts=await pg(`SELECT
      (SELECT count(*) FROM ${schema}.metadata_ledger
        WHERE organization_reference=${asLiteral(tenant)}
          AND submission_reference=${asLiteral(submission)})||'|'||
      (SELECT count(*) FROM ${schema}.metadata_outbox
        WHERE organization_reference=${asLiteral(tenant)}
          AND submission_reference=${asLiteral(submission)}
          AND event_kind='pending_review');`);
    assert.equal(counts,'1|1','F96 expected one logical entry and one outbox event');

    // F148: o PostgreSQL registra metadados + outbox, mas uma falha
    // posterior impede uma resposta positiva. O retry só observa duplicata.
    const firstUnknown=await bodyOf(await post(h,unknownEnvelope),503);
    assert.equal(firstUnknown.reasonCode,'LAB_METADATA_NOT_CONFIRMED');
    const afterUnknown=await pg(`SELECT
      (SELECT count(*) FROM ${schema}.metadata_ledger
        WHERE organization_reference=${asLiteral(tenant)}
          AND submission_reference=${asLiteral(unknownSubmission)})||'|'||
      (SELECT count(*) FROM ${schema}.metadata_outbox
        WHERE organization_reference=${asLiteral(tenant)}
          AND submission_reference=${asLiteral(unknownSubmission)}
          AND event_kind='pending_review');`);
    assert.equal(afterUnknown,'1|1',
      'F148 committed metadata remains durable despite lost HTTP outcome');
    const retried=await bodyOf(await post(h,unknownEnvelope));
    assert.equal(retried.reasonCode,'DUPLICATE_SYNTHETIC_METADATA');
    const finalUnknown=await pg(`SELECT
      (SELECT count(*) FROM ${schema}.metadata_ledger
        WHERE organization_reference=${asLiteral(tenant)}
          AND submission_reference=${asLiteral(unknownSubmission)})||'|'||
      (SELECT count(*) FROM ${schema}.metadata_outbox
        WHERE organization_reference=${asLiteral(tenant)}
          AND submission_reference=${asLiteral(unknownSubmission)}
          AND event_kind='pending_review');`);
    assert.equal(finalUnknown,'1|1','F148 retry must not create second event');

    // F149: genuinely destroy the HTTP response socket AFTER PostgreSQL
    // committed. Unlike F148 there is no readable HTTP status at all.
    await assert.rejects(post(h,disconnectEnvelope),{name:'TypeError'},
      'F149 first request must fail at the transport layer');
    const disconnectedCount=await pg(`SELECT
      (SELECT count(*) FROM ${schema}.metadata_ledger
        WHERE organization_reference=${asLiteral(tenant)}
          AND submission_reference=${asLiteral(disconnectSubmission)})||'|'||
      (SELECT count(*) FROM ${schema}.metadata_outbox
        WHERE organization_reference=${asLiteral(tenant)}
          AND submission_reference=${asLiteral(disconnectSubmission)}
          AND event_kind='pending_review');`);
    assert.equal(disconnectedCount,'1|1',
      'F149 transaction survives broken HTTP connection');
    const disconnectedReplay=await bodyOf(await post(h,disconnectEnvelope));
    assert.equal(disconnectedReplay.reasonCode,'DUPLICATE_SYNTHETIC_METADATA');
    const disconnectedCountAfter=await pg(`SELECT
      (SELECT count(*) FROM ${schema}.metadata_ledger
        WHERE organization_reference=${asLiteral(tenant)}
          AND submission_reference=${asLiteral(disconnectSubmission)})||'|'||
      (SELECT count(*) FROM ${schema}.metadata_outbox
        WHERE organization_reference=${asLiteral(tenant)}
          AND submission_reference=${asLiteral(disconnectSubmission)}
          AND event_kind='pending_review');`);
    assert.equal(disconnectedCountAfter,'1|1',
      'F149 transport reconnect cannot insert another ledger or outbox');

    for(const field of [
      'organization_reference','binding_reference','site_reference',
      'form_reference','destination_reference'
    ]){
      const forged={...envelope,[field]:'77777777-7777-4777-8777-777777777777'};
      assert.equal((await bodyOf(await post(h,forged),403)).reasonCode,
        'UNTRUSTED_BINDING_CONTEXT');
    }
    for(const forbidden of ['email','phone','name','consent','message']){
      const candidate={...envelope,[forbidden]:'synthetic-only'};
      assert.equal((await bodyOf(await post(h,candidate),422)).reasonCode,
        'METADATA_ENVELOPE_REJECTED');
    }
    assert.equal((await bodyOf(await post(h,envelope,{auth:null}),401)).reasonCode,
      'SYNTHETIC_SERVICE_AUTH_REQUIRED');

    const after=await pg(`SELECT state||'|'||version FROM ${schema}.metadata_ledger
      WHERE organization_reference=${asLiteral(tenant)}
        AND submission_reference=${asLiteral(submission)};`);
    assert.equal(after,'open|0');
    const event=await pg(`SELECT state||'|'||claim_version||'|'||attempts
      FROM ${schema}.metadata_outbox
      WHERE organization_reference=${asLiteral(tenant)}
        AND submission_reference=${asLiteral(submission)};`);
    assert.equal(event,'queued|0|0');
    assert.equal(h.recordedCount(),0,
      'F96 PG-backed adapter cannot claim local in-memory persistence');
  }finally{
    await h.close();
  }
  console.log('F96/F148/F149 PASS: HTTP synthetic metadata -> ephemeral PG + 503/socket-loss retry; no CRM delivery.');
}
await run();

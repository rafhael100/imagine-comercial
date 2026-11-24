import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compareFaiscaPrivateLedgerWindow as compare } from '../ops/faisca/openai/private-ledger-window.mjs';
import { inspectFaiscaPrivatePostRunLedger as inspect } from '../ops/faisca/openai/private-post-run-ledger.mjs';
import { createFaiscaLocalReservationLedger } from '../ops/faisca/openai/durable-reservation-ledger.mjs';

const report = (requests=0, reservedMicros=0) => ({
  schema:'faisca.private-post-run-ledger.v1',status:'PRIVATE_LOCAL_LEDGER_READONLY_READY',
  localCountersStable:true,localReadinessVerified:true,requests,reservedMicros,
  limitRequests:100,limitMicros:10_000_000,processExitVerified:false,
  providerUsageReconciled:false,atomicAcrossProcesses:false,operationalEffects:false,publicReady:false
});
test('R349 independent observations match two or four local reservations only', () => {
  for (const n of [2,4]) {
    const result = compare(report(1,100),report(1+n,100+n*10),n);
    assert.equal(result.localDeltaVerified,true);
    assert.equal(result.requestDelta,n);
    assert.equal(result.reservedMicrosDelta,n*10);
    for (const k of ['sameLedgerIdentityVerified','reviewedShaVerified','processExitVerified',
      'providerUsageReconciled','atomicAcrossProcesses','operationalEffects','publicReady']) assert.equal(result[k],false);
  }
});
test('R349 zero, excess, rollback, insufficient money delta and changed limits fail closed', () => {
  for (const [before,after,n] of [
    [report(),report(),2], [report(),report(3,3),2],
    [report(4,40),report(2,20),2], [report(1,100),report(3,101),2],
    [report(),{...report(2,2),limitRequests:99},2],
    [report(),report(1,1),1], [report(),report(2,2),'2']
  ]) {
    const result=compare(before,after,n);
    assert.equal(result.localDeltaVerified,false);
    assert.equal(result.requestDelta,null);
    assert.equal(result.reservedMicrosDelta,null);
  }
});
test('R349 fenced or malformed evidence, additional fields and accessors are rejected', () => {
  const after=report(2,2);
  const accessor={...after};
  Object.defineProperty(accessor,'requests',{enumerable:true,get(){throw new Error('not executed');}});
  for (const item of [null,[],{...after,status:'PRIVATE_LOCAL_LEDGER_RECONCILIATION_REQUIRED'},
    {...after,localReadinessVerified:false},{...after,providerUsageReconciled:true},
    {...after,secret:'synthetic-extra'},accessor,{...after,requests:2.5}]) {
    assert.equal(compare(report(),item,2).localDeltaVerified,false);
  }
});
test('R349 compares actual read-only reports around real disposable ledger reservations', async () => {
  const directory=await mkdtemp(join(tmpdir(),'faisca-r349-'));
  try {
    await chmod(directory,0o700);
    const ledger=createFaiscaLocalReservationLedger({directory,maxRequests:100,maxBudgetUsd:10});
    const before=await inspect({ledger});
    await ledger.reserve(0.01); await ledger.reserve(0.02);
    const after=await inspect({ledger});
    const result=compare(before,after,2);
    assert.equal(result.localDeltaVerified,true);
    assert.equal(result.reservedMicrosDelta,30_000);
    await ledger.markOutcomeUncertain();
    assert.equal(compare(before,await inspect({ledger}),2).localDeltaVerified,false);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
test('R349 CLI accepts bounded observations, blocks credential-bearing and malformed input', () => {
  const script=fileURLToPath(new URL('../scripts/faisca-private-ledger-window.mjs',import.meta.url));
  const input=JSON.stringify([report(),report(2,2)]);
  const env={PATH:process.env.PATH,FAISCA_PRIVATE_LEDGER_AUDIT_ACK:'YES_LOCAL_READONLY_NO_PROVIDER_PROOF'};
  const run=(value,extra={},n='2')=>spawnSync(process.execPath,[script,n],{
    input:value,encoding:'utf8',timeout:5000,env:{...env,...extra}
  });
  const good=run(input);
  assert.equal(good.status,0,good.stderr);
  assert.equal(JSON.parse(good.stdout).localDeltaVerified,true);
  for (const result of [run(input,{OPENAI_API_KEY:''}),run(input,{FAISCA_REVIEW_BEARER_TOKEN:''}),
    run('synthetic-secret-invalid-json'),run(' '.repeat(4097)),run(input,{},'1')]) {
    assert.equal(result.status,2);
    assert.equal(result.stdout,'');
    assert.doesNotMatch(result.stderr,/synthetic-secret/);
  }
  assert.equal(run(JSON.stringify([report(),report()])).status,1);
});

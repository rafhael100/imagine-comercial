import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const script=new URL('../scripts/review-private-budget-to-crm.mjs',import.meta.url);
test('P0 F160: operator review matrix runs without secrets, receipts or customer data',()=>{
 const r=spawnSync(process.execPath,[script.pathname],{
  cwd:process.cwd(),encoding:'utf8',env:{PATH:process.env.PATH}
 });
 assert.equal(r.status,0,r.stderr);
 const report=JSON.parse(r.stdout);
 assert.equal(report.schema,'imagine.comercial.private-budget-review-matrix.v1');
 assert.equal(report.mode,'OFFLINE_SYNTHETIC_ONLY');
 assert.equal(report.operationalReadiness,'BLOCKED');
 assert.equal(report.sampleCount,5);
 assert.deepEqual(report.results.map(x=>x.reasonCode),[
  'ATOMIC_STORE_REQUIRED','INVALID_CONTACT_ROUTE','STALE_SNAPSHOT_RECONCILE',
  'UNKNOWN_OUTCOME_LOOKUP_REQUIRED','PINNED_CONTEXT_CONFLICT'
 ]);
 for(const result of report.results){
  assert.equal(result.canCreateCrmLead,false);
  assert.equal(result.canAcknowledgeVisitor,false);
 }
 for(const pii of ['Cliente inteiramente fictício','demo@example.invalid',
  'bde4f010-aacf-4ad7','Exemplo sem informação pessoal'])
  assert.equal(r.stdout.includes(pii),false);
});
test('P0 F160: public inputs are rejected and the CLI has no IO pathways',()=>{
 const bad=spawnSync(process.execPath,[script.pathname,'--file','/tmp/customer.csv'],{
  encoding:'utf8',env:{PATH:process.env.PATH}
 });
 assert.notEqual(bad.status,0);
 assert.match(bad.stderr,/no CLI arguments supported/);
 const source=readFileSync(script,'utf8');
 assert.doesNotMatch(source,/\bfetch\s*\(|\bcreateServer\s*\(|\bwriteFile\s*\(|\breadFile\s*\(|\breadFileSync\s*\(/);
});

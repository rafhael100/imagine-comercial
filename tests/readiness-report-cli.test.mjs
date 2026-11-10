import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {renderReadinessReport} from '../scripts/report-launch-blockers.mjs';
import {RELEASE_GATES} from '../src/lib/launch-readiness.mjs';
test('F43 offline report lists every unresolved production gate',()=>{
 const data=JSON.parse(renderReadinessReport());
 assert.equal(data.target,'production');
 assert.deepEqual(data.blockers,RELEASE_GATES);
 assert.equal(data.count,9);
 assert.equal(data.approval,'NOT_AUTHORIZED');
 assert.equal(data.deploymentPerformed,false);
});
test('F43 explicit staging still does not infer operational approval',()=>{
 const data=JSON.parse(renderReadinessReport(['--target=staging']));
 assert.equal(data.target,'staging');
 assert.equal(data.count,9);
 assert.equal(data.approval,'NOT_AUTHORIZED');
});
test('F43 refuses flags and paths that could import untrusted approvals',()=>{
 for(const args of [['--input=approvals.json'],['--target=live'],['--target=production','--confirm'],
 ['--target=staging','--input=/tmp/ok.json']]){
  assert.throws(()=>renderReadinessReport(args),/expected only/);
 }
});
test('F43 CLI provides machine-readable result without secrets and does not deploy',()=>{
 const result=spawnSync(process.execPath,['scripts/report-launch-blockers.mjs'],{
  encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH,HOME:process.env.HOME}});
 assert.equal(result.status,0,result.stderr);
 const output=JSON.parse(result.stdout);
 assert.equal(output.count,RELEASE_GATES.length);
 assert.equal(output.approval,'NOT_AUTHORIZED');
 assert.ok(!result.stdout.includes('PRIVATE_KEY'));
});
test('F43 invalid CLI args exit nonzero',()=>{
 const result=spawnSync(process.execPath,['scripts/report-launch-blockers.mjs','--deploy'],{
  encoding:'utf8',timeout:10000});
 assert.equal(result.status,2);
 assert.match(result.stderr,/rejected/);
});

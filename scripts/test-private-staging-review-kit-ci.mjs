/**
 * F318: prove the review-kit verifier detects tampered site bytes and
 * unreviewed Nginx config. All work stays in local temporary directories.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cpSync,mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const kit='artifacts/private-staging-review-kit';
const metadata=JSON.parse(readFileSync(join(kit,'REVIEW-ONLY-kit-metadata.json'),'utf8'));
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
assert.equal(metadata.deployPerformed,false);
assert.equal(metadata.noCredentialsIncluded,true);
if(process.env.GITHUB_EVENT_PATH){
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  if(event?.pull_request?.head?.sha){
    assert.equal(metadata.sourceCommit,event.pull_request.head.sha,
      'F318: source must be real PR head, not its transient test merge');
    assert.equal(metadata.sourceCommitFromPrHead,true);
    assert.equal(metadata.ciEvaluationCommit,process.env.GITHUB_SHA);
  }
}
assert.ok(metadata.sourceCommit===null||sha(metadata.sourceCommit));
assert.ok(metadata.ciEvaluationCommit===null||sha(metadata.ciEvaluationCommit));

function check(cwd){
  const output=spawnSync(process.execPath,['verify-kit.mjs'],{
    cwd,encoding:'utf8',timeout:10000,
    env:{PATH:process.env.PATH??'',CI:'true'}
  });
  assert.ok(output.error===undefined,'F318: review verifier must be executable');
  return output;
}
const good=check(kit);
assert.equal(good.status,0,'F318: original artifact must verify');
assert.match(good.stdout,/PASS:/);
assert.match(good.stdout,/REVIEW ONLY/);
const workspace=mkdtempSync(join(tmpdir(),'comercial-private-kit-f318-'));
try{
  const brokenSite=join(workspace,'site-tamper');
  cpSync(kit,brokenSite,{recursive:true});
  const page=join(brokenSite,'dist','index.html');
  writeFileSync(page,Buffer.concat([readFileSync(page),Buffer.from('SYNTHETIC_TAMPER')]));
  const bad=check(brokenSite);
  assert.notEqual(bad.status,0,'F318: mutated HTML must fail');
  assert.match(bad.stderr,/HOLD:/);
  assert.doesNotMatch(bad.stderr,/SYNTHETIC_TAMPER/);
  const brokenConfig=join(workspace,'nginx-tamper');
  cpSync(kit,brokenConfig,{recursive:true});
  const conf=join(brokenConfig,'ops/staging/nginx.conf');
  writeFileSync(conf,readFileSync(conf,'utf8')+'\n# SYNTHETIC_MUTATION\n');
  const badConfig=check(brokenConfig);
  assert.notEqual(badConfig.status,0,'F318: modified Nginx must fail');
  assert.match(badConfig.stderr,/HOLD:/);
  assert.doesNotMatch(badConfig.stderr,/SYNTHETIC_MUTATION/);
  console.log('F318 PASS: exact kit verified; site and Nginx corruption independently rejected (NO DEPLOY).');
}finally{
  rmSync(workspace,{recursive:true,force:true});
}

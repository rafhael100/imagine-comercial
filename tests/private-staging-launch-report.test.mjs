import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderReadinessReport} from '../scripts/report-launch-blockers.mjs';
import {PRIVATE_STAGING_REVIEW_STAGES as stages,reportUnverifiedPrivateStaging}
  from '../src/lib/private-staging-prerequisite-report.mjs';

const chain=readFileSync(new URL('../scripts/review-private-staging-chain.mjs',import.meta.url),'utf8');

test('F301 report names the exact six operator stages without claiming staging pass',()=>{
  const result=reportUnverifiedPrivateStaging();
  assert.deepEqual(stages.map(s=>s.id),[
    'source-and-package','running-container','active-nginx',
    'full-http','http-methods','reserved-paths'
  ]);
  assert.equal(result.requiredStages,6);
  assert.equal(result.independentlyVerifiedStages,0);
  assert.deepEqual(result.unresolvedStages,stages.map(s=>s.id));
  assert.equal(result.status,'BLOCKED_EXTERNAL_PRIVATE_STAGING_NOT_ATTESTED');
  for(const key of ['canClaimStagingRuntimeObserved','remoteTlsFirewallAndSshVerified',
    'independentShaAndImageProvenanceVerified','portalCrmLiveDeliveryVerified',
    'appsecDbaLgpdApproved','canCollectPublicLeads','productionAuthorized',
    'deploymentPerformed'])
    assert.equal(result[key],false,key);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.unresolvedStages));
  assert.ok(stages.every(s=>Object.isFrozen(s)));
});

test('F301 private stage runbook is linked to the actual six-stage operator command',()=>{
  for(const item of stages){
    assert.match(item.id,/^[a-z][a-z-]+$/);
    assert.match(item.script,/^scripts\/[a-z0-9-]+\.mjs$/);
    assert.ok(item.requirement.length>24);
    assert.ok(chain.includes("'"+item.id+"'"),item.id);
    assert.ok(chain.includes("'"+item.script+"'"),item.script);
  }
  assert.match(chain,/methods:evidence\[4\]/);
  assert.match(chain,/reserved:evidence\[5\]/);
  assert.doesNotMatch(chain,/\bdocker\s+(?:up|run|start|pull|push)\b/);
});

test('F301 offline launch JSON includes six NO-GO stages for both targets',()=>{
  for(const target of ['production','staging']){
    const data=JSON.parse(renderReadinessReport(['--target='+target]));
    assert.deepEqual(data.privateStagingLeaseweb,reportUnverifiedPrivateStaging());
    assert.equal(data.status,'BLOCKED_REVIEW_ONLY');
    assert.equal(data.approval,'NOT_AUTHORIZED');
    assert.equal(data.deploymentPerformed,false);
    assert.equal(data.privateStagingLeaseweb.independentlyVerifiedStages,0);
    const output=JSON.stringify(data);
    for(const unsafe of ['PRIVATE_PASSWORD','BEGIN PRIVATE KEY','htpasswd-bcrypt-secret'])
      assert.equal(output.includes(unsafe),false);
  }
});

test('F301 stage inventory cannot be advanced by user-supplied flags',()=>{
  const altered=reportUnverifiedPrivateStaging({approved:true,runtimeVerified:true});
  assert.equal(altered.independentlyVerifiedStages,0);
  assert.equal(altered.productionAuthorized,false);
});

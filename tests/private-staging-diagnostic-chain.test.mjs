import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {evaluateReadOnlyPrivateStagingChain as evaluate}
  from '../src/lib/private-staging-diagnostic-chain.mjs';

function healthy(){
  return {
    preflight:{
      immutableDigestSyntax:true,deploymentAuthorized:false,deploymentPerformed:false,
      config:{status:'REVIEWED_SOURCE_CONFIG_MATCH_ONLY'},
      buildIntegrity:{exactTreeBytesVerified:true},
      authFile:{filePermissionsPrivate:true}
    },
    container:{
      status:'RUNNING_CONTAINER_INSPECT_FIELDS_MATCH_REVIEW_ONLY',
      actualLoopbackPortBindingReported:true,
      threeReadonlyMountsReported:true,
      constrainedDockerPrivilegesReported:true,
      productionAuthorized:false,deploymentPerformed:false
    },
    nginx:{
      status:'LOADED_NGINX_CONFIG_EQUALS_REVIEWED_SOURCE_ONLY',
      expectedStaticConfigLoaded:true,unapprovedAdditionalConfigFileAbsent:true,
      duplicateServerBlockAbsent:true,deployAuthorized:false,deployedByThisCheck:false
    },
    http:{
      status:'PRIVATE_CANDIDATE_REVIEWED_STILL_NO_RELEASE_AUTHORITY',
      checks:{
        coverageProfile:'COMPLETE_PRIVATE_CATALOG_AND_LEGACY',
        servedHtmlMatchesLocalPinnedBuild:true,
        servedStaticAssetsMatchPinnedBuild:true,
        buildTreeBytesStableAfterHttp:true,
        unauthenticatedHomepageDenied:true
      },
      canCollectPublicLeads:false,deploymentAuthorized:false,deploymentPerformed:false
    }
  };
}
test('F258 all four READ-ONLY results never become deployment approval',()=>{
  const report=evaluate(healthy());
  assert.equal(report.validatedGates,4);
  assert.equal(report.status,'PRIVATE_DIAGNOSTIC_CHAIN_PASSED_NOT_RELEASE_APPROVAL');
  for(const k of ['localSourceAndBuildPreflightPassed',
    'runningContainerInspectPassed','loadedNginxConfigPassed',
    'completePrivateHttpByteParityPassed'])assert.equal(report[k],true,k);
  for(const k of ['externalTlsAndFirewallIndependentlyVerified',
    'imageOriginAndLiveDigestIndependentlyVerified',
    'portalCrmDurableDeliveryVerified',
    'applicationSecurityAndPrivacyApprovalPresent',
    'legacyRedirectsApproved','launchOwnerApproved','canCollectPublicLeads',
    'deploymentAuthorized','deploymentPerformed'])
    assert.equal(report[k],false,k);
  assert.ok(Object.isFrozen(report));
});
test('F258 missing, mismatched or misleading gate results fail closed',()=>{
  const sources=[
    r=>r.preflight.config.status='OTHER',
    r=>r.preflight.immutableDigestSyntax=false,
    r=>r.preflight.buildIntegrity.exactTreeBytesVerified=false,
    r=>r.preflight.authFile.filePermissionsPrivate=false,
    r=>r.preflight.deploymentAuthorized=true,
    r=>r.container.actualLoopbackPortBindingReported=false,
    r=>r.container.threeReadonlyMountsReported=false,
    r=>r.container.constrainedDockerPrivilegesReported=false,
    r=>r.container.productionAuthorized=true,
    r=>r.nginx.expectedStaticConfigLoaded=false,
    r=>r.nginx.unapprovedAdditionalConfigFileAbsent=false,
    r=>r.nginx.duplicateServerBlockAbsent=false,
    r=>r.nginx.deployAuthorized=true,
    r=>r.http.checks.coverageProfile='PARTIAL',
    r=>r.http.checks.servedHtmlMatchesLocalPinnedBuild=false,
    r=>r.http.checks.servedStaticAssetsMatchPinnedBuild=false,
    r=>r.http.checks.buildTreeBytesStableAfterHttp=false,
    r=>r.http.checks.unauthenticatedHomepageDenied=false,
    r=>r.http.canCollectPublicLeads=true,
    r=>r.http.deploymentAuthorized=true,
    r=>{delete r.http.checks;}
  ];
  for(const tamper of sources){
    const item=healthy();
    tamper(item);
    assert.throws(()=>evaluate(item),/F258/);
  }
  assert.throws(()=>evaluate(),/F258/);
});
test('F258 actual CLI invokes four non-deploying scripts sequentially',()=>{
  const entry=new URL('../scripts/review-private-staging-chain.mjs',import.meta.url);
  const source=readFileSync(entry,'utf8');
  for(const path of [
    'scripts/check-private-staging-prerequisites.mjs',
    'scripts/inspect-running-private-staging.mjs',
    'scripts/check-running-private-nginx.mjs',
    'scripts/review-private-staging-operator.mjs'
  ])assert.ok(source.includes(path));
  assert.match(source,/stages=Object\.freeze\(\[/);
  assert.match(source,/evaluateReadOnlyPrivateStagingChain\(/);
  assert.match(source,/\['--port=4321'\]/);
  assert.doesNotMatch(source,/['"](?:up|run|restart|start|stop|pull|push|rm)['"]/);
  assert.doesNotMatch(source,/console\.log\(r\.stdout\)|console\.error\(r\.stderr\)/);
  const secret='F258_OPERATOR_PASSWORD_NOT_FOR_LOGS';
  const run=spawnSync(process.execPath,[entry.pathname],{
    encoding:'utf8',timeout:12000,
    env:{...process.env,GITHUB_ACTIONS:'true',
      IMAGINE_PRIVATE_STAGING_REVIEW:'1',IMAGINE_STAGING_REVIEW_PASSWORD:secret}
  });
  assert.equal(run.status,2);
  assert.equal(run.stdout,'');
  assert.match(run.stderr,/operator-ack not verified \(HOLD\)/);
  assert.equal(run.stderr.includes(secret),false);
});

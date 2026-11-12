import test from 'node:test';
import assert from 'node:assert/strict';
import {renderReadinessReport} from '../scripts/report-launch-blockers.mjs';
import {sitePages} from '../src/data/services.mjs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {buildStagingHostRouteChecklist} from '../src/lib/staging-host-route-matrix.mjs';

for(const target of [[],['--target=staging']]){
  test('F229 launch blockers carry host decision without inventing operational authorization ('+
    (target.length?'staging':'production')+')',()=>{
    const result=JSON.parse(renderReadinessReport(target));
    const host=result.canonicalHostMigration;
    assert.equal(host.target,'https://imaginecomunicacao.com.br');
    assert.equal(host.decision,'APPROVED_TARGET_ONLY_REDIRECTS_NOT_AUTHORIZED');
    assert.equal(host.publishedRoutes,sitePages.length);
    assert.equal(host.historicalCandidateRoutes,5);
    assert.equal(host.historicalHeldRoutes,22);
    assert.equal(host.historicalCandidateRoutes+host.historicalHeldRoutes,legacyUrls.length);
    assert.equal(host.fourHostStagingChecklistEntries,buildStagingHostRouteChecklist().length);
    assert.equal(host.realStagingHttpVerified,false);
    assert.equal(host.urlByUrlSeoMigrationApproved,false);
    assert.equal(host.productionRedirectsAuthorized,0);
    assert.equal(host.dnsChangesAuthorized,false);
    assert.equal(host.releaseAuthorized,false);
    assert.ok(result.blockers.includes('gsc-real-crawl-and-redirect-review'));
    assert.ok(result.blockers.includes('staging-private-vps'));
    assert.equal(result.approval,'NOT_AUTHORIZED');
    assert.equal(result.deploymentPerformed,false);
  });
}

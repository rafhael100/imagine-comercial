import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildStagingHostRouteChecklist,reviewStagingHostRouteObservations}
  from '../src/lib/staging-host-route-matrix.mjs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('F230 future edge checklist cannot claim Leaseweb private staging verification',()=>{
  const rows=buildStagingHostRouteChecklist().map(x=>({
    origin:x.origin,path:x.path,status:x.expectedStatus,location:x.expectedLocation,
    tlsValid:x.expectedTlsValid,noindex:x.expectedNoindex
  }));
  const result=reviewStagingHostRouteObservations(rows);
  assert.equal(result.passed,true);
  assert.equal(result.profile,'FUTURE_PUBLIC_EDGE_TARGET_SIMULATION_NOT_LEASEWEB_PRIVATE');
  assert.equal(result.realPublicEdgeVerified,false);
  assert.equal(result.privateLeasewebStagingVerified,false);
  assert.equal(result.productionAuthorized,false);
  assert.equal(result.redirectsAuthorized,0);
  assert.match(result.warning,/Leaseweb private Nginx/);
});

test('F230 private Nginx remains noindex, Basic Auth, localhost and without host redirects',()=>{
  const nginx=file('ops/staging/nginx.conf');
  const compose=file('ops/staging/compose.yaml');
  assert.match(nginx,/auth_basic "Imagine private review"/);
  assert.match(nginx,/X-Robots-Tag "noindex, nofollow, noarchive"/);
  assert.match(compose,/127\.0\.0\.1:4321:8080/);
  assert.doesNotMatch(nginx,/\breturn\s+30[1278]\b/);
});

test('F230 future edge reviewer cannot be confused with private staging review CLI',()=>{
  const code=file('scripts/review-host-route-staging.mjs');
  assert.match(code,/IMAGINE_PRIVATE_STAGING_REVIEW==='1'/);
  assert.match(code,/futureEdgeContractPassed/);
  assert.doesNotMatch(code,/stagingContractPassed/);
});

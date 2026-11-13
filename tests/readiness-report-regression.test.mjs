import test from 'node:test';
import assert from 'node:assert/strict';
import {renderReadinessReport} from '../scripts/report-launch-blockers.mjs';
import {RELEASE_GATES} from '../src/lib/launch-readiness.mjs';
import {sitePages} from '../src/data/services.mjs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';

test('F243: staging and production offline reports never imply release authorization', () => {
  for (const target of ['staging', 'production']) {
    const report = JSON.parse(renderReadinessReport([`--target=${target}`]));
    assert.equal(report.schema, 'imagine.comercial.offline-blocker-report.v1');
    assert.equal(report.target, target);
    assert.equal(report.status, 'BLOCKED_REVIEW_ONLY');
    assert.equal(report.approval, 'NOT_AUTHORIZED');
    assert.equal(report.deploymentPerformed, false);
    assert.equal(report.checkedAgainst, 'F42_STATIC_GATES_NOT_RUNTIME_VERIFICATION');
    assert.equal(report.count, RELEASE_GATES.length);
    assert.deepEqual(report.blockers, RELEASE_GATES);
    assert.equal(report.canonicalHostMigration.publicEdgeHttpVerified, false);
    assert.equal(report.canonicalHostMigration.realStagingHttpVerified, false);
    assert.equal(report.canonicalHostMigration.urlByUrlSeoMigrationApproved, false);
    assert.equal(report.canonicalHostMigration.productionRedirectsAuthorized, 0);
    assert.equal(report.canonicalHostMigration.dnsChangesAuthorized, false);
    assert.equal(report.canonicalHostMigration.releaseAuthorized, false);
  }
});

test('F243: report counts come from the actual route inventories, not stale literals', () => {
  const report = JSON.parse(renderReadinessReport([]));
  assert.equal(report.target, 'production');
  assert.equal(report.canonicalHostMigration.publishedRoutes, sitePages.length);
  assert.equal(report.canonicalHostMigration.historicalCandidateRoutes,
    legacyUrls.filter(route => route.status === 'candidate').length);
  assert.equal(report.canonicalHostMigration.historicalHeldRoutes,
    legacyUrls.filter(route => route.status === 'hold').length);
  assert.equal(report.canonicalHostMigration.historicalCandidateRoutes +
    report.canonicalHostMigration.historicalHeldRoutes, legacyUrls.length);
});

test('F243: operator report rejects unknown arguments and forged launch status', () => {
  for (const args of [
    ['--target=live'], ['--target=staging', '--approve'],
    ['--target=production', '--target=staging'], ['--approve'],
    ['--target=staging', '--token=secret'], ['--target=']
  ]) assert.throws(() => renderReadinessReport(args), /expected only/);
});

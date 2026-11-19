import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  PORTAL_CRM_OPERATIONAL_ACCEPTANCE,
  reviewPortalCrmOperationalBoundary
} from '../src/lib/portal-crm-operational-boundary.mjs';
import {renderReadinessReport} from '../scripts/report-launch-blockers.mjs';

test('F94: all Portal/CRM operational acceptance criteria have owners and testable requirements',()=>{
  const a=PORTAL_CRM_OPERATIONAL_ACCEPTANCE;
  assert.equal(a.length,14);
  assert.ok(Object.isFrozen(a));
  assert.equal(new Set(a.map(x=>x.id)).size,a.length);
  for(const criterion of a){
    assert.ok(Object.isFrozen(criterion));
    assert.deepEqual(Object.keys(criterion),['id','accountable','test','availableLab']);
    assert.match(criterion.id,/^[a-z][a-z0-9-]+$/);
    assert.ok(criterion.accountable.length>2);
    assert.ok(criterion.test.length>30);
    assert.ok(criterion.availableLab.length>5);
    assert.match(criterion.availableLab,/(F\d+|NO_|CI_|LAB_)/);
  }
  for(const id of [
    'visitor-privacy-notice-and-lawful-basis',
    'browser-abuse-protection',
    'portal-receiver-deployment',
    'service-identity-and-tenant-binding',
    'consent-provenance-and-audit',
    'atomic-lead-reservation',
    'transactional-outbox-and-worker',
    'replay-and-key-management',
    'remote-crm-ack-and-consistency',
    'unknown-outcome-reconciliation',
    'operational-privacy-and-retention',
    'legacy-budget-form-parity',
    'independent-security-review',
    'release-owner-explicit-approval'
  ])assert.ok(a.some(x=>x.id===id),id);
});

test('F94: source-control lab evidence is NEVER converted into operational authorization',()=>{
  const report=reviewPortalCrmOperationalBoundary();
  assert.equal(report.schema,'imagine.comercial.portal-crm-operational-boundary.v1');
  assert.equal(report.evidenceClass,'CODE_REVIEW_SNAPSHOT_NOT_RUNTIME_VERIFICATION');
  assert.equal(report.state,'BLOCKED_NO_INDEPENDENT_OPERATIONAL_EVIDENCE');
  assert.equal(report.requiredCount,14);
  assert.equal(report.independentlyVerifiedCount,0);
  assert.deepEqual(report.unresolved,PORTAL_CRM_OPERATIONAL_ACCEPTANCE.map(x=>x.id));
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.unresolved));
  for(const key of [
    'canCollectPublicLeads','canTrustTenantClaims','canClaimDurableCrmReceipt',
    'canAutoRetryUnknownOutcome','canReplaceLegacyContactForm','canDeploy',
    'deploymentPerformed'
  ])assert.equal(report[key],false,key);
  // Even caller-supplied approvals or lab CI "success" cannot alter output.
  const forged=reviewPortalCrmOperationalBoundary({
    reviewStatus:'approved',deploymentAuthorized:true,
    crmReceipt:'LAB_MAC_MATCH_UNTRUSTED',securityReview:true
  });
  assert.deepEqual(forged,report);
});

test('F94: CLI includes the 14 requirements for BOTH release targets, still always blocked',()=>{
  for(const args of [[],['--target=staging']]){
    const report=JSON.parse(renderReadinessReport(args));
    assert.ok(report.blockers.includes('portal-outbox-remote-witness'));
    assert.ok(report.blockers.includes('crm-durable-consent-privacy'));
    assert.ok(report.blockers.includes('legacy-contact-intake-parity'));
    assert.equal(report.portalCrmIntegration.requiredCount,14);
    assert.equal(report.portalCrmIntegration.independentlyVerifiedCount,0);
    assert.equal(report.portalCrmIntegration.canDeploy,false);
    assert.equal(report.portalCrmIntegration.canCollectPublicLeads,false);
    assert.equal(report.portalCrmIntegration.canClaimDurableCrmReceipt,false);
    assert.equal(report.approval,'NOT_AUTHORIZED');
    assert.equal(report.deploymentPerformed,false);
    assert.ok(!JSON.stringify(report).includes('PRIVATE_KEY'));
  }
});

test('F94: all evidentiary states remain out of the built public site',()=>{
  const source=readFileSync(new URL('../src/lib/portal-crm-operational-boundary.mjs',import.meta.url),'utf8');
  const contact=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|sendBeacon\s*\(|https?:\/\/|localStorage/);
  assert.doesNotMatch(contact,/portal-crm-operational-boundary|<form\b|fetch\s*\(/);
  assert.ok(!source.includes('canDeploy:true'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {reviewLegacyHttpContinuity} from '../src/lib/legacy-http-continuity-review.mjs';
import {renderReadinessReport} from '../scripts/report-launch-blockers.mjs';

function makeSnapshot(scope, statusByPath={}){
 return {
  schema:'imagine.comercial.legacy-http-snapshot.v1',scope,
  rows:legacyUrls.map(({from})=>{
   const override=statusByPath[from]??{};
   const status=override.status??200;
   const isHtml=status===200;
   const bodySha256=isHtml?
    (override.bodySha256??createHash('sha256').update('synthetic-original:'+from).digest('hex')):null;
   return {path:from,status,mime:isHtml?'text/html':null,bodySha256,
    bytes:isHtml?(override.bytes??3120):0,redirectTo:override.redirectTo??null};
  })
 };
}
function review(afterChanges={},beforeChanges={}){
 return reviewLegacyHttpContinuity(
  makeSnapshot('BEFORE_ORIGINAL',beforeChanges),
  makeSnapshot('AFTER_CANDIDATE',afterChanges));
}
test('F-LEGACY-HTTP exact 27 legacy routes, with all 22 HOLD preserved only allows read-only observations',()=>{
 const r=review();
 assert.equal(r.knownLegacyPaths,27);
 assert.equal(r.heldPaths,22);
 assert.equal(r.candidatePaths,5);
 assert.equal(r.heldPreservedExact,22);
 assert.equal(r.candidatesPreservedExact,5);
 assert.equal(r.allHeldBytePreserved,true);
 assert.equal(r.newSiteCanReplaceOriginal,false);
 assert.equal(r.redirectsAuthorized,0);
 assert.equal(r.actualDeploymentPerformed,false);
 assert.equal(r.sourceSnapshotTrustedIndependently,false);
 assert.ok(Object.isFrozen(r));
 assert.ok(!JSON.stringify(r).includes('/en-us/'));
});
test('F-LEGACY-HTTP detects content loss, changed legal bytes and vanished English pages',()=>{
 const r=review({
  '/en-us/':{status:404},
  '/en-us/termos-de-uso.html':{bodySha256:createHash('sha256').update('changed terms').digest('hex')},
  '/clientes.html':{status:404}
 });
 assert.equal(r.heldOriginallyHtml,22);
 assert.equal(r.heldPreservedExact,19);
 assert.equal(r.heldMissingOrChanged,3);
 assert.equal(r.allHeldBytePreserved,false);
 assert.equal(r.newSiteCanReplaceOriginal,false);
});
test('F-LEGACY-HTTP candidate 301 is not an approved production redirect',()=>{
 const route=legacyUrls.find(x=>x.status==='candidate');
 const r=review({[route.from]:{status:301,redirectTo:route.to}});
 assert.equal(r.candidateRedirectsStillUnauthorized,1);
 assert.equal(r.candidatesPreservedExact,4);
 assert.equal(r.redirectsAuthorized,0);
 assert.equal(r.observed301IsAuthorization,false);
});
test('F-LEGACY-HTTP records old 404 as unproven, never equates it with safe deletion',()=>{
 const r=review({},{
  '/en-us/customers.html':{status:404}
 });
 assert.equal(r.heldOriginalStatusUnproven,1);
 assert.equal(r.heldOriginallyHtml,21);
 assert.equal(r.allHeldBytePreserved,false);
});
test('F-LEGACY-HTTP rejects missing, extra, duplicated and arbitrary paths',()=>{
 const before=makeSnapshot('BEFORE_ORIGINAL');
 const after=makeSnapshot('AFTER_CANDIDATE');
 const clone=x=>structuredClone(x);
 const missing=clone(after);missing.rows.pop();
 const dupe=clone(after);dupe.rows[0].path=dupe.rows[1].path;
 const unknown=clone(after);unknown.rows[0].path='/en-us/admin/';
 const spurious=clone(after);spurious.approved=true;
 const fakeRedirect=clone(after);fakeRedirect.rows[0].status=301;
 const forged=clone(after);forged.rows[0].mime='application/octet-stream';
 const noncanonical=clone(after);noncanonical.rows[0].bytes=0;
 for(const bad of [missing,dupe,unknown,spurious,fakeRedirect,forged,noncanonical]){
  assert.throws(()=>reviewLegacyHttpContinuity(before,bad),/F-LEGACY-HTTP:/);
 }
});
test('F-LEGACY-HTTP rejects inherited data, sparse arrays and getters without executing code',()=>{
 const before=makeSnapshot('BEFORE_ORIGINAL');
 const after=makeSnapshot('AFTER_CANDIDATE');
 let invoked=0;
 const unsafe=makeSnapshot('AFTER_CANDIDATE');
 Object.defineProperty(unsafe.rows[0],'status',{
  enumerable:true,get(){invoked++;throw Error('DO_NOT_READ_SECRET')}
 });
 assert.throws(()=>reviewLegacyHttpContinuity(before,unsafe),/F-LEGACY-HTTP:/);
 assert.equal(invoked,0);
 const inherited=structuredClone(after);
 Object.setPrototypeOf(inherited.rows[0],{});
 assert.throws(()=>reviewLegacyHttpContinuity(before,inherited),/F-LEGACY-HTTP:/);
 const sparse=structuredClone(after);
 delete sparse.rows[0];
 assert.throws(()=>reviewLegacyHttpContinuity(before,sparse),/F-LEGACY-HTTP:/);
});

test('F-LEGACY-HTTP production blocker report always exposes missing live provenance and lead-intake continuity',()=>{
 const report=JSON.parse(renderReadinessReport(['--target=production']));
 const check=report.legacyHttpContinuity;
 assert.equal(report.approval,'NOT_AUTHORIZED');
 assert.equal(check.totalKnownRoutes,27);
 assert.equal(check.heldMustBePreserved,22);
 assert.equal(check.redirectCandidatesRequireEditorialReview,5);
 assert.equal(check.originalPublicHttpSnapshotIndependentlyReviewed,false);
 assert.equal(check.candidatePrivateHttpSnapshotIndependentlyReviewed,false);
 assert.equal(check.samePageHtmlByteParityVerified,false);
 assert.equal(check.historicalFormsAndLeadsDeliveryVerified,false);
 assert.equal(check.readyToReplaceLegacySite,false);
 assert.equal(check.deploymentPerformed,false);
});

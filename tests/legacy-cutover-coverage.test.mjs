import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {reviewLegacyCutoverCoverage as review} from '../src/lib/legacy-cutover-coverage.mjs';
import {renderReadinessReport} from '../scripts/report-launch-blockers.mjs';

test('F277 release report explicitly blocks discontinuity of all known legacy routes',()=>{
  const report=JSON.parse(renderReadinessReport(['--target=production']));
  const risk=report.legacyCutover;
  assert.equal(risk.schema,'imagine.comercial.legacy-cutover-coverage.v1');
  assert.equal(risk.knownLegacyRoutes,legacyUrls.length);
  assert.equal(risk.heldLegacyRoutes,22);
  assert.equal(risk.candidateLegacyRoutes,5);
  assert.equal(risk.heldRoutesWithoutRetainAssertion,22);
  assert.equal(risk.missingDecisions,27);
  assert.equal(risk.completePlanningCoverage,false);
  assert.equal(risk.canReplaceLegacySite,false);
  assert.equal(risk.redirectsAuthorized,0);
  assert.equal(report.approval,'NOT_AUTHORIZED');
});

test('F277 operator planning can identify all 27 routes but never authorize cutover',()=>{
  const decisions=legacyUrls.map(e=>({
    from:e.from,plan:e.status==='hold'?'retain-original':'review-redirect'
  }));
  const result=review(decisions);
  assert.equal(result.knownLegacyRoutes,27);
  assert.equal(result.operatorAssertedRetainCount,22);
  assert.equal(result.candidateRedirectsOnlyForReview,5);
  assert.equal(result.heldRoutesWithoutRetainAssertion,0);
  assert.equal(result.missingDecisions,0);
  assert.equal(result.pendingDecisions,0);
  assert.equal(result.completePlanningCoverage,true);
  for(const field of ['originalLegacyContentLiveHttpVerified',
    'editorialAndLegalEquivalenceApproved','indexedGscCoverageIndependentlyVerified',
    'canReplaceLegacySite','dnsChangeAuthorized','productionAuthorized',
    'deploymentPerformed']) assert.equal(result[field],false,field);
  assert.equal(result.redirectsAuthorized,0);
  assert.ok(Object.isFrozen(result));
  assert.ok(!JSON.stringify(result).includes('/en-us/'));
});

test('F277 HOLD route can only be retained or left unresolved, not redirected',()=>{
  const hold=legacyUrls.find(x=>x.status==='hold');
  assert.throws(()=>review([{from:hold.from,plan:'review-redirect'}]),
    /HOLD legacy route/);
  const pending=review([{from:hold.from,plan:'pending'}]);
  assert.equal(pending.pendingDecisions,1);
  assert.equal(pending.heldRoutesWithoutRetainAssertion,22);
});

test('F277 source/plan must be exact and cannot smuggle approvals',()=>{
  const one=legacyUrls[0].from;
  for(const decisions of [
    [{from:one,plan:'approved'}],
    [{from:one,plan:'delete-original'}],
    [{from:'/unverified.html',plan:'retain-original'}],
    [{from:one,plan:'retain-original',approved:true}],
    [{from:one,plan:'pending'},{from:one,plan:'retain-original'}],
    new Array(28).fill({from:one,plan:'pending'})
  ])assert.throws(()=>review(decisions),/F277:/);
});

test('F277 accessor and symbol spoofing cannot execute secret getters',()=>{
  const one=legacyUrls[0].from;
  let called=0;
  const bad={from:one,plan:'pending'};
  Object.defineProperty(bad,'plan',{enumerable:true,
    get(){called++;throw Error('PRIVATE-F277-GETTER');}
  });
  assert.throws(()=>review([bad]),/F277:/);
  assert.equal(called,0);
  const symbol={from:one,plan:'pending'};
  symbol[Symbol('private')]='secret';
  assert.throws(()=>review([symbol]),/F277:/);
});


test('F277 decorated, sparse, inherited and accessor-bearing arrays are rejected first',()=>{
  const one=legacyUrls[0].from;
  const ordinary={from:one,plan:'pending'};
  const sparse=new Array(2);
  sparse[1]=ordinary;
  const decorated=[ordinary];
  Object.defineProperty(decorated,'secret',{value:'PRIVATE-F277',enumerable:false});
  const inherited=[ordinary];
  Object.setPrototypeOf(inherited,Object.create(Array.prototype));
  const getter=[ordinary];
  let called=0;
  Object.defineProperty(getter,'0',{enumerable:true,configurable:true,
    get(){called++;throw Error('PRIVATE-F277');}
  });
  for(const value of [sparse,decorated,inherited,getter])
    assert.throws(()=>review(value),/invalid legacy cutover decisions/);
  assert.equal(called,0);
  assert.equal(review(JSON.parse(JSON.stringify([ordinary]))).pendingDecisions,1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewGscPagesCsv} from '../src/lib/gsc-inventory-review.mjs';
import {reviewGscApiPageEvidence} from '../src/lib/gsc-page-api-review.mjs';
import {reviewGscSearchAnalyticsPages} from '../src/lib/gsc-search-analytics-review.mjs';
import {reviewCanonicalHostMigration} from '../src/lib/host-canonical-review.mjs';

const domain='www.imaginecomunicacao.com.br';
const https='https://'+domain+'/';
const http='http://'+domain+'/';
const row=(uri,clicks=1,impressions=100)=>({
  keys:[uri],clicks,impressions,ctr:clicks/impressions,position:8
});

test('F152: CSV evidence does not collapse HTTP and HTTPS under same host/path',()=>{
  const reviewed=reviewGscPagesCsv('Page\n'+https+'\n'+http+'\n'+http+'\n');
  assert.equal(reviewed.inputRows,3);
  assert.equal(reviewed.uniqueRows,2);
  const schemes=reviewed.rows.map(x=>x.observedHttp).sort();
  assert.deepEqual(schemes,[false,true]);
  const httpRow=reviewed.rows.find(x=>x.observedHttp);
  assert.equal(httpRow.state,'protocol_hold_for_manual_review');
  assert.equal(httpRow.proposedTarget,null);
  assert.equal(reviewed.heldRows,1);
});

test('F152: API metrics remain tied to exact protocol, with explicit canonical hold',()=>{
  const review=reviewGscApiPageEvidence({
    rows:[row(http,3,50),row(https,9,100)]
  });
  assert.equal(review.summary.rowsReceived,2);
  assert.equal(review.summary.reviewedRows,2);
  assert.equal(review.summary.clicks,12);
  const a=review.rows.find(x=>x.observedHttp);
  const b=review.rows.find(x=>!x.observedHttp);
  assert.equal(a.clicks,3);
  assert.equal(b.clicks,9);
  assert.equal(a.proposedTarget,null);
  assert.equal(a.state,'protocol_hold_for_manual_review');
  const plan=reviewCanonicalHostMigration(review);
  assert.equal(plan.protocolHeld,1);
  assert.equal(plan.candidateHostOnly,1);
  assert.equal(plan.approvedRedirects,0);
  assert.equal(plan.productionRedirectsAuthorized,false);
  assert.equal(plan.canonicalHostChangeAuthorized,false);
  assert.equal(plan.actions.find(x=>x.observedHttp).proposedCanonical,null);
  assert.equal(plan.actions.find(x=>x.observedHttp).status,'PROTOCOL_HOLD_REQUIRES_REVIEW');
});

test('F152: private page dimension report preserves scheme but drops GSC metrics and queries',()=>{
  const report=reviewGscSearchAnalyticsPages({
    siteUrl:'sc-domain:imaginecomunicacao.com.br',
    dimensions:['page'],
    rows:[row(https,100,200),row(http,20,150)]
  });
  assert.equal(report.uniqueRows,2);
  assert.deepEqual(report.rows.map(x=>x.observedHttp).sort(),[false,true]);
  assert.equal(report.metricsDiscarded,true);
  assert.equal(report.approvedRedirects,0);
  assert.doesNotMatch(JSON.stringify(report),/impressions|clicks|ctr|position/);
});

test('F152: duplicate URL and forged scheme metadata cannot authorize or hide variants',()=>{
  assert.throws(()=>reviewGscApiPageEvidence({rows:[row(http),row(http)]}),
    /duplicated page key/);
  const review=reviewGscApiPageEvidence({rows:[row(http),row(https)]});
  for(const mutated of [
    {...review.rows[0],observedHttp:'true'},
    {...review.rows[0],observedHttp:null},
    {...review.rows[0],redirectApproved:true}
  ]) assert.throws(()=>reviewCanonicalHostMigration({...review,rows:[mutated]}),
    /malformed page evidence/);
  const token='PRIVATE-URL-TOKEN-4051';
  const secured=reviewGscPagesCsv('Page\n'+http+'?token='+token+'\n');
  assert.equal(secured.rows[0].proposedTarget,null);
  assert.doesNotMatch(JSON.stringify(secured),new RegExp(token));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createQualificationJourney, respondQualificationJourney } from '../ops/faisca/qualification/journey.mjs';
import { getCompletedQuoteSite } from '../ops/faisca/journey/journey-ui.mjs';

const choose=(session,id)=>respondQualificationJourney(session,{type:'action',id});
function complete(service='goal_presence'){
  let t=choose(createQualificationJourney(),service);
  t=choose(t.session,'confirm_goal');
  for(const id of ['r08:objective:present_company','r08:audience:businesses',
    'r08:materials:ready','r08:timeline:within_30_days',
    'r08:contactConsent:declined'])t=choose(t.session,id);
  assert.equal(t.session.phase,'complete');
  return t.session;
}

test('R42 a complete Onepage selection loses quote authority during change and pending confirmation',()=>{
  const selected=complete();
  assert.equal(getCompletedQuoteSite(selected),'onepage');
  const reselect=choose(selected,'r08:change_service');
  assert.equal(reselect.session.phase,'service_reselect');
  assert.equal(reselect.session.profile,selected.profile);
  assert.equal(getCompletedQuoteSite(reselect.session),null);
  const pending=choose(reselect.session,'goal_campaign');
  assert.equal(pending.session.phase,'service_change_pending');
  assert.equal(pending.session.profile,selected.profile);
  assert.equal(getCompletedQuoteSite(pending.session),null);
  const cancelled=choose(pending.session,'cancel_goal');
  assert.equal(cancelled.session.phase,'complete');
  assert.equal(getCompletedQuoteSite(cancelled.session),'onepage');
  assert.equal(cancelled.session.profile.service,'onepage');
});

test('R42 acceptance of another service starts fresh incomplete answers, not stale quote transfer',()=>{
  const existing=complete();
  const r=choose(existing,'r08:change_service');
  const proposed=choose(r.session,'goal_campaign');
  const confirmed=choose(proposed.session,'confirm_goal');
  assert.equal(confirmed.session.profile.service,'landing-page');
  assert.equal(confirmed.session.phase,'qualification');
  assert.equal(getCompletedQuoteSite(confirmed.session),null);
  let current=confirmed.session;
  for(const id of ['r08:objective:capture_leads','r08:audience:businesses',
    'r08:materials:ready','r08:timeline:within_30_days',
    'r08:contactConsent:declined'])current=choose(current,id).session;
  assert.equal(current.phase,'complete');
  assert.equal(getCompletedQuoteSite(current),'landing-pages');
});

test('R42 original incomplete qualification and restart cannot authorize a quote',()=>{
  assert.equal(getCompletedQuoteSite(null),null);
  assert.equal(getCompletedQuoteSite(createQualificationJourney()),null);
  const t=choose(createQualificationJourney(),'goal_presence');
  assert.equal(getCompletedQuoteSite(t.session),null);
  const started=choose(t.session,'confirm_goal');
  assert.equal(getCompletedQuoteSite(started.session),null);
  const selected=complete();
  const reset=choose(selected,'r08:restart');
  assert.equal(reset.session.profile,null);
  assert.equal(getCompletedQuoteSite(reset.session),null);
  // Even a forged phase with a plain object cannot pass the profile trust gate.
  assert.equal(getCompletedQuoteSite({phase:'complete',profile:{...selected.profile}}),null);
});

test('R42 browser bridge fail-closes during a pending action and performs no network',async()=>{
  const code=await readFile(new URL('../ops/faisca/composition/quote-bridge.mjs',import.meta.url),'utf8');
  assert.match(code,/getAttribute\('aria-busy'\) !== 'false'/);
  assert.match(code,/data-faisca-quote-site/);
  assert.match(code,/Object\.hasOwn\(allowed,\s*value\)/);
  assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|postMessage|localStorage|sessionStorage/);
});

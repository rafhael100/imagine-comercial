import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {validateRedirectPlan,toCloudflareRedirectRules} from '../src/lib/redirect-plan.mjs';

const reason='Equivalência editorial revisada e ainda sujeita ao gate de release.';
const approved=(from,to)=>({from,to,status:'approved',reason});

test('F280 only the five inventoried candidates may generate review 301 text',()=>{
  const candidates=legacyUrls.filter(entry=>entry.status==='candidate');
  assert.equal(candidates.length,5);
  const plan=validateRedirectPlan(candidates.map(entry=>approved(entry.from,entry.to)));
  const lines=toCloudflareRedirectRules(plan).split('\n');
  assert.equal(lines.length,5);
  for(const item of candidates)
    assert.ok(lines.includes(item.from+' '+item.to+' 301'),item.from);
});

test('F280 arbitrary approved source is not a reviewed migration path',()=>{
  for(const from of ['/unknown-legacy-page.html','/new-campaign.html','/en-us.html']){
    // Generic planning can represent proposed sources for internal review,
    // but it can never produce a Cloudflare rule without inventory.
    const plan=validateRedirectPlan([approved(from,'/contato/')]);
    assert.equal(plan.active.length,1);
    assert.throws(()=>toCloudflareRedirectRules(plan),
      /unreviewed source cannot generate a 301 rule/);
  }
});

test('F280 legacy HOLD cannot be rendered through either path',()=>{
  for(const entry of legacyUrls.filter(x=>x.status==='hold')){
    assert.throws(()=>validateRedirectPlan([approved(entry.from,'/contato/')]),
      /HOLD route cannot become a redirect/);
  }
  assert.equal(toCloudflareRedirectRules(validateRedirectPlan(legacyUrls)),'');
});

test('F280 forged manifest is rejected before checking the candidate list',()=>{
  assert.throws(()=>toCloudflareRedirectRules({active:[approved('/fale-conosco.html','/contato/')]}),
    /validated manifest required/);
});

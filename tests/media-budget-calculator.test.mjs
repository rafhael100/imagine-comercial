import test from 'node:test';
import assert from 'node:assert/strict';
import {CHANNELS,parseMoneyToCents,formatBRL,calculateMediaBudget} from '../src/lib/media-budget-calculator.mjs';

test('approved floor/reference per provider, never duplicate Meta placements',()=>{
  assert.deepEqual(Object.keys(CHANNELS).sort(),['chatgpt_ads','google_ads','meta_ads']);
  assert.equal(CHANNELS.meta_ads.floorCents,70000);
  assert.equal(CHANNELS.google_ads.floorCents,100000);
  assert.equal(CHANNELS.chatgpt_ads.floorCents,120000);
  assert.equal(CHANNELS.meta_ads.recommendedCents,100000);
  assert.equal(CHANNELS.google_ads.recommendedCents,150000);
  assert.equal(CHANNELS.chatgpt_ads.recommendedCents,180000);
});

test('minimum and recommended are different, management stays separate',()=>{
  const p=calculateMediaBudget({channels:['chatgpt_ads','meta_ads','google_ads']});
  assert.equal(p.minimumMediaCents,290000);
  assert.equal(p.recommendedBaselineCents,430000);
  assert.equal(p.suggestedMediaCents,430000);
  assert.equal(p.illustrativeManagementCents,86000);
  assert.equal(p.illustrativeTotalCents,516000);
  assert.equal(p.mediaPaidDirectlyToPlatforms,true);
  assert.equal(p.doesNotGuaranteeLeadsOrSales,true);
  assert.equal(p.publicCheckoutEnabled,false);
  assert.equal(p.leadSentToCrm,false);
});

test('user historical CPL scenario is clearly not a forecast',()=>{
  const p=calculateMediaBudget({channels:['meta_ads'],objective:'leads',targetLeads:30,historicalCplCents:5000});
  assert.equal(p.goalScenarioCents,150000);
  assert.equal(p.suggestedMediaCents,150000);
  assert.equal(p.illustrativeManagementCents,30000);
  assert.equal(p.historicalCplSuppliedByVisitor,true);
  assert.match(p.methodology,/cenário, não previsão/);
});

test('no historical CPL leaves baseline alone',()=>{
  const p=calculateMediaBudget({channels:['google_ads'],objective:'sales'});
  assert.equal(p.suggestedMediaCents,150000);
  assert.equal(p.goalScenarioCents,null);
  assert.match(p.methodology,/não é possível calcular quantidade de leads/);
});

test('visitor cap is warning only; never silently lower recommendations',()=>{
  const p=calculateMediaBudget({channels:['chatgpt_ads'],monthlyLimitCents:120000});
  assert.equal(p.minimumMediaCents,120000);
  assert.equal(p.suggestedMediaCents,180000);
  assert.equal(p.exceedsMonthlyLimit,true);
});
test('decimal conversion exact, BRL locale, no floats',()=>{
  assert.equal(parseMoneyToCents('40,50'),4050);
  assert.equal(parseMoneyToCents('40.05'),4005);
  assert.equal(parseMoneyToCents('0'),0);
  assert.equal(parseMoneyToCents('2000,5'),200050);
  assert.match(formatBRL(290000),/2\.900,00/);
  for(const invalid of ['','1.234,56','-1','1e5','100.999','Infinity',' NaN ', '100,0,0']) {
    assert.throws(()=>parseMoneyToCents(invalid),RangeError);
  }
});
test('invalid channel, forged copies and missing one part of goal fail closed',()=>{
  for(const channels of [[],['meta_ads','meta_ads'],['fake_ads'],['google_ads','meta_ads','chatgpt_ads','x']]){
    assert.throws(()=>calculateMediaBudget({channels}),RangeError);
  }
  assert.throws(()=>calculateMediaBudget({channels:['meta_ads'],targetLeads:20}),RangeError);
  assert.throws(()=>calculateMediaBudget({channels:['meta_ads'],historicalCplCents:1000}),RangeError);
  assert.throws(()=>calculateMediaBudget({channels:['meta_ads'],objective:'unapproved'}),RangeError);
  assert.throws(()=>calculateMediaBudget({channels:['meta_ads'],monthlyLimitCents:-1}),RangeError);
  assert.throws(()=>calculateMediaBudget({channels:['meta_ads'],targetLeads:100000,historicalCplCents:100000000}),RangeError);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCommercialChoicePreview} from '../src/lib/commercial-choice-preview.mjs';
import {splitThreeIllustrativeInstallments} from '../src/lib/commercial-illustrative-installments.mjs';

test('F329: approved displayed examples never lose cents in three interest-free installments',()=>{
 const scenarios=[
  [0,[0,0,0]], [99000,[33000,33000,33000]],
  [129000,[43000,43000,43000]],
  [49000,[16333,16333,16334]],
  [98000,[32666,32666,32668]],
  [148000,[49333,49333,49334]],
  [197000,[65666,65666,65668]],
  [227000,[75666,75666,75668]]
 ];
 for(const [total,expected] of scenarios){
  const split=splitThreeIllustrativeInstallments(total);
  assert.deepEqual([split.firstCents,split.secondCents,split.thirdCents],expected);
  assert.equal(split.firstCents+split.secondCents+split.thirdCents,total);
  assert.equal(split.lastCentAdjustmentCents,expected[2]-expected[0]);
  assert.equal(split.installmentCount,3);
  assert.equal(split.realCheckoutAuthorized,false);
  assert.equal(split.realCombinedPaymentAuthorized,false);
  assert.ok(Object.isFrozen(split));
 }
});

test('F329: every public product/channel combination has an exact non-billing breakdown',()=>{
 let count=0;
 const combos=[
  [],['google_ads'],['meta_ads'],['chatgpt_ads'],
  ['google_ads','meta_ads'],['google_ads','chatgpt_ads'],
  ['meta_ads','chatgpt_ads'],['google_ads','meta_ads','chatgpt_ads']
 ];
 for(const site of ['none','onepage','landing-pages'])
  for(const channels of combos)
   for(const tier of ['minimum','recommended']){
    const estimate=buildCommercialChoicePreview({site,channels,tier});
    const parts=splitThreeIllustrativeInstallments(estimate.contractedSetupAndActivationCents);
    assert.equal(parts.totalCents,estimate.siteSetupCents+estimate.adActivationCents);
    assert.equal(parts.firstCents+parts.secondCents+parts.thirdCents,parts.totalCents);
    assert.equal(estimate.eligibleForPublicCheckout,false);
    assert.equal(estimate.customerDataCaptured,false);
    count++;
   }
 assert.equal(count,48);
});

test('F329: invalid money values cannot become installment illustrations',()=>{
 for(const bad of [-1,1.1,Number.NaN,Infinity,1e8+1,'99000',null,{},undefined])
  assert.throws(()=>splitThreeIllustrativeInstallments(bad),TypeError);
});

test('F329: three-installment UI shows installment and grand total; never authorizes PSP',()=>{
 const src=readFileSync(new URL('../src/components/CommercialChoicePreview.astro',import.meta.url),'utf8');
 assert.match(src,/Implantação \+ ativações \(3x sem juros\)/);
 assert.match(src,/data-choice-three/);
 assert.match(src,/data-choice-last/);
 assert.match(src,/data-choice-total/);
 assert.match(src,/splitThreeIllustrativeInstallments\(estimate\.contractedSetupAndActivationCents\)/);
 assert.match(src,/gateway homologarem esse calendário conjunto/);
 assert.doesNotMatch(src,/<form\b|<input\b|XMLHttpRequest|localStorage|sessionStorage|sendBeacon/);
});

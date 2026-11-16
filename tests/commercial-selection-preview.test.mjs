import test from 'node:test';
import assert from 'node:assert/strict';
import {
  previewCommercialSelection,PREVIEW_CHANNELS,PREVIEW_SITES,PREVIEW_POLICY
} from '../src/lib/commercial-selection-preview.mjs';
import {REVIEWED_OFFERS,REVIEWED_CHANNELS} from '../ops/review/purchase/private-portal-handoff-policy.mjs';

test('F324 approved site prices are exact cents, monthly D+90 from contract, not publication',()=>{
 for(const [offer,setup,installment] of [
  ['onepage',99000,33000],['landing-pages',129000,43000]
 ]) {
  const quote=previewCommercialSelection({offer});
  assert.equal(quote.policy,PREVIEW_POLICY);
  assert.equal(quote.setupCents,setup);
  assert.equal(quote.installmentCount,3);
  assert.equal(quote.installmentCents,installment);
  assert.equal(quote.installmentCount*quote.installmentCents,quote.setupCents);
  assert.equal(quote.monthlyCents,7990);
  assert.equal(quote.firstMonthlyAfterDays,90);
  assert.equal(quote.firstMonthlyRelativeTo,'contract_date_not_publication');
  assert.equal(quote.paymentNowCents,null);
  assert.equal(quote.realChargeEnabled,false);
  assert.equal(quote.requiresPortalRecalculation,true);
  assert.ok(Object.isFrozen(quote));
 }
});
test('F324 approved media minimum vs recommended amounts, management and activation separated',()=>{
 assert.deepEqual(Object.keys(PREVIEW_CHANNELS).sort(),['google_ads','meta_ads']);
 assert.equal(PREVIEW_CHANNELS.google_ads.minimumMediaCents,100000);
 assert.equal(PREVIEW_CHANNELS.google_ads.recommendedMediaCents,150000);
 assert.equal(PREVIEW_CHANNELS.meta_ads.minimumMediaCents,70000);
 assert.equal(PREVIEW_CHANNELS.meta_ads.recommendedMediaCents,100000);
 const google=previewCommercialSelection({offer:'performance',channels:{google_ads:100000}});
 const meta=previewCommercialSelection({offer:'performance',channels:{meta_ads:70000}});
 const both=previewCommercialSelection({offer:'performance',channels:{google_ads:100000,meta_ads:70000}});
 assert.equal(google.activationCents,49000);
 assert.equal(google.estimatedMonthlyManagementCents,20000);
 assert.equal(meta.activationCents,49000);
 assert.equal(meta.estimatedMonthlyManagementCents,17000);
 assert.equal(both.activationCents,98000);
 assert.equal(both.plannedMediaPaidToPlatformsCents,170000);
 assert.equal(both.estimatedMonthlyManagementCents,37000);
 assert.equal(both.minimumMonthlyManagementPerChannelCents,17000);
 assert.equal(both.managementSettledOn,'verified_actual_media_full_civil_month');
 assert.equal(both.mediaPaidDirectlyToPlatforms,true);
 assert.equal(both.paymentNowCents,null);
 assert.equal(both.checkoutAuthorized,false);
 assert.equal(both.realChargeEnabled,false);
 assert.equal(both.channels.length,2);
 assert.ok(Object.isFrozen(both.channels));
 assert.ok(Object.isFrozen(both.channels[0]));
});
test('F324 R$350 is not eligible as new Google budget; R$4000 gives R$800 estimated management',()=>{
 assert.throws(()=>previewCommercialSelection({offer:'performance',channels:{google_ads:35000}}),/under approved minimum/);
 assert.equal(previewCommercialSelection({offer:'performance',channels:{google_ads:400000}})
   .estimatedMonthlyManagementCents,80000);
 // Higher media at Meta does not permit bypassing Google minimum.
 assert.throws(()=>previewCommercialSelection({offer:'performance',channels:{meta_ads:200000,google_ads:99999}}),/under approved minimum/);
});
test('F324 fail closed for prices, customer attributes, unsupported channels and payment instructions',()=>{
 const invalid=[
  null,{},[],{offer:'performance'},{offer:'performance',channels:{}},
  {offer:'performance',channels:{chatgpt_ads:120000}},
  {offer:'performance',channels:{google_ads:100000,meta_ads:0}},
  {offer:'performance',channels:{google_ads:100000,clientId:'123'}},
  {offer:'performance',channels:{google_ads:100000.5}},
  {offer:'performance',channels:{google_ads:'100000'}},
  {offer:'performance',channels:{google_ads:NaN}},
  {offer:'performance',channels:{google_ads:Infinity}},
  {offer:'performance',channels:{google_ads:-1}},
  {offer:'performance',channels:{google_ads:100000001}},
  {offer:'onepage',channels:{}},
  {offer:'landing-pages',payment_method:'asaas'},
  {offer:'performance',channels:{meta_ads:70000},owner:'other-tenant'},
  {offer:'sites-por-assinatura'},
  {offer:'gestao-chatgpt-ads'}
 ];
 for(const selection of invalid)assert.throws(()=>previewCommercialSelection(selection),/F324:/,JSON.stringify(selection));
});
test('F324 preview knows only catalog channels supported by private Portal handoff; no dynamic URL',()=>{
 assert.deepEqual(new Set(Object.values(REVIEWED_CHANNELS)),new Set(Object.keys(PREVIEW_CHANNELS)));
 assert.ok(Object.keys(REVIEWED_OFFERS).includes('onepage'));
 assert.ok(Object.keys(REVIEWED_OFFERS).includes('landing-pages'));
 assert.equal(PREVIEW_SITES.onepage.setupCents,99000);
 const summary=previewCommercialSelection({offer:'performance',channels:{meta_ads:100000}});
 for(const forbidden of ['redirect','token','checkoutUrl','customerId','auth','gateway','invoice']){
  assert.equal(Object.hasOwn(summary,forbidden),false);
 }
 assert.equal(summary.estimatedOnly,true);
});

test('F324 selection and public calculator share one approved policy for Google/Meta',async()=>{
 const {calculateMediaBudget,CHANNELS,illustrateFullMonthManagementCents}=await import('../src/lib/media-budget-calculator.mjs');
 for(const code of ['google_ads','meta_ads']) {
  const publicPolicy=CHANNELS[code];
  assert.equal(PREVIEW_CHANNELS[code].minimumMediaCents,publicPolicy.floorCents);
  assert.equal(PREVIEW_CHANNELS[code].recommendedMediaCents,publicPolicy.recommendedCents);
  for(const budget of [publicPolicy.floorCents,publicPolicy.recommendedCents,400000]){
   const selection=previewCommercialSelection({offer:'performance',channels:{[code]:budget}});
   assert.equal(selection.estimatedMonthlyManagementCents,illustrateFullMonthManagementCents(budget));
  }
 }
 const publicEstimate=calculateMediaBudget({channels:['google_ads','meta_ads']});
 const channelBudgets=Object.fromEntries(publicEstimate.channels.map(c=>[c.id,c.suggestedCents]));
 const estimate=previewCommercialSelection({offer:'performance',channels:channelBudgets});
 assert.equal(estimate.estimatedMonthlyManagementCents,publicEstimate.illustrativeManagementCents);
 assert.equal(estimate.activationCents,publicEstimate.oneTimeActivationCents);
 assert.equal(estimate.plannedMediaPaidToPlatformsCents,publicEstimate.suggestedMediaCents);
});

test('F342 refuses hidden fields or accessors in public commercial budget selection',()=>{
 const good={offer:'onepage'};
 assert.equal(previewCommercialSelection(good).setupCents,99000);
 assert.equal(previewCommercialSelection(Object.assign(Object.create(null),good)).setupCents,99000);
 let reads=0;
 const accessor={};
 Object.defineProperty(accessor,'offer',{enumerable:true,
  get(){reads++;throw Error('PRIVATE-GETTER-DO-NOT-RUN');}});
 assert.throws(()=>previewCommercialSelection(accessor),/F324: Invalid selection/);
 assert.equal(reads,0);
 const hidden={offer:'onepage'};
 Object.defineProperty(hidden,'customerEmail',{value:'PRIVATE-CUSTOMER@example.invalid'});
 assert.throws(()=>previewCommercialSelection(hidden),/F324:/);
 const symbol={offer:'onepage'};
 symbol[Symbol('tenantToken')]='PRIVATE';
 assert.throws(()=>previewCommercialSelection(symbol),/F324:/);
 const inherited=Object.create({offer:'onepage'});
 assert.throws(()=>previewCommercialSelection(inherited),/F324:/);
 const performanceAccessor={offer:'performance'};
 Object.defineProperty(performanceAccessor,'channels',{enumerable:true,
  get(){reads++;return {google_ads:100000};}});
 assert.throws(()=>previewCommercialSelection(performanceAccessor),/F324:/);
 assert.equal(reads,0);
});

test('F342 rejects nested hidden budget data, accessors and symbol tenant metadata',()=>{
 let reads=0;
 const getterChannels={};
 Object.defineProperty(getterChannels,'google_ads',{enumerable:true,
  get(){reads++;throw Error('PRIVATE-FINANCIAL-GETTER');}});
 assert.throws(()=>previewCommercialSelection({
  offer:'performance',channels:getterChannels
 }),/F324:/);
 assert.equal(reads,0);
 const hidden={google_ads:100000};
 Object.defineProperty(hidden,'tenantId',{value:'PRIVATE-TENANT'});
 assert.throws(()=>previewCommercialSelection({offer:'performance',channels:hidden}),/F324:/);
 const token={meta_ads:70000};
 token[Symbol('paymentInstruction')]='PRIVATE';
 assert.throws(()=>previewCommercialSelection({offer:'performance',channels:token}),/F324:/);
 const inherited=Object.create({google_ads:100000});
 assert.throws(()=>previewCommercialSelection({offer:'performance',channels:inherited}),/F324:/);
 const frozen=Object.freeze({google_ads:100000,meta_ads:70000});
 const valid=previewCommercialSelection(Object.freeze({
  offer:'performance',channels:frozen
 }));
 assert.equal(valid.plannedMediaPaidToPlatformsCents,170000);
 assert.equal(valid.estimatedMonthlyManagementCents,37000);
 assert.equal(valid.checkoutAuthorized,false);
});

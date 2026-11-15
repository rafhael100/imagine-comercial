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

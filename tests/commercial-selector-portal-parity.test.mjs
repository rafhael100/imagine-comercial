import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCommercialChoicePreview,REVIEWED_SITE_CHOICES,REVIEWED_CHANNEL_CHOICES}
 from '../src/lib/commercial-choice-preview.mjs';
import {previewCommercialSelection,PREVIEW_SITES,PREVIEW_CHANNELS}
 from '../src/lib/commercial-selection-preview.mjs';
import {CHANNELS,illustrateFullMonthManagementCents}
 from '../src/lib/media-budget-calculator.mjs';

test('F326 PT EN ES use one source for approved prices and media floors',()=>{
 for(const slug of ['onepage','landing-pages']){
  const fromWebsite=REVIEWED_SITE_CHOICES[slug];
  const core=PREVIEW_SITES[slug];
  assert.equal(fromWebsite.setupCents,core.setupCents);
  assert.equal(fromWebsite.installmentCents,core.installmentCents);
  assert.equal(fromWebsite.monthlyCents,core.monthlyCents);
  assert.equal(core.installments*core.installmentCents,core.setupCents);
  assert.equal(core.firstMonthlyAfterDays,90);
 }
 for(const channel of ['google_ads','meta_ads']){
  assert.equal(REVIEWED_CHANNEL_CHOICES[channel].minimumMediaCents,PREVIEW_CHANNELS[channel].minimumMediaCents);
  assert.equal(REVIEWED_CHANNEL_CHOICES[channel].recommendedMediaCents,PREVIEW_CHANNELS[channel].recommendedMediaCents);
  assert.equal(REVIEWED_CHANNEL_CHOICES[channel].minimumMediaCents,CHANNELS[channel].floorCents);
  assert.equal(REVIEWED_CHANNEL_CHOICES[channel].recommendedMediaCents,CHANNELS[channel].recommendedCents);
  assert.equal(REVIEWED_CHANNEL_CHOICES[channel].activationCents,49000);
 }
});
test('F326 every eligible anonymous UI combination reconciles with Portal-checked quote core',()=>{
 let cases=0;
 const sets=[[],['google_ads'],['meta_ads'],['google_ads','meta_ads']];
 for(const site of ['none','onepage','landing-pages']){
  for(const channels of sets){
   for(const tier of ['minimum','recommended']){
    const choice=buildCommercialChoicePreview({site,channels,tier});
    const siteQuote=site==='none'?null:previewCommercialSelection({offer:site});
    const adBudgets=Object.fromEntries(channels.map(channel=>[
      channel,tier==='minimum'?PREVIEW_CHANNELS[channel].minimumMediaCents:PREVIEW_CHANNELS[channel].recommendedMediaCents
    ]));
    const adsQuote=channels.length===0?null:previewCommercialSelection({offer:'performance',channels:adBudgets});
    assert.equal(choice.siteSetupCents,siteQuote?.setupCents??0);
    assert.equal(choice.siteInstallmentCents,siteQuote?.installmentCents??0);
    assert.equal(choice.siteMonthlyCents,siteQuote?.monthlyCents??0);
    assert.equal(choice.adMediaCents,adsQuote?.plannedMediaPaidToPlatformsCents??0);
    assert.equal(choice.adActivationCents,adsQuote?.activationCents??0);
    assert.equal(choice.adManagementEstimateCents,adsQuote?.estimatedMonthlyManagementCents??0);
    assert.equal(choice.contractedSetupAndActivationCents,choice.siteSetupCents+choice.adActivationCents);
    assert.equal(choice.eligibleForPublicCheckout,false);
    assert.equal(choice.customerDataCaptured,false);
    assert.equal(choice.actualManagementRequiresPostpaidVerification,true);
    for(const line of choice.adLines){
      assert.equal(line.managementCents,illustrateFullMonthManagementCents(line.mediaCents));
    }
    cases++;
   }
  }
 }
 assert.equal(cases,24);
});
test('F326 never use ChatGPT Ads price references as enabled checkout or accept unknown channels',()=>{
 assert.equal(REVIEWED_CHANNEL_CHOICES.chatgpt_ads,undefined);
 assert.throws(()=>buildCommercialChoicePreview({site:'none',channels:['chatgpt_ads'],tier:'minimum'}));
 assert.throws(()=>previewCommercialSelection({offer:'performance',channels:{chatgpt_ads:120000}}));
});

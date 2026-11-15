import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCommercialChoicePreview,REVIEWED_SITE_CHOICES,REVIEWED_CHANNEL_CHOICES} from '../src/lib/commercial-choice-preview.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('F324: reviewed website installments and day-90 recurring fees',()=>{
 const one=buildCommercialChoicePreview({site:'onepage',channels:[],tier:'recommended'});
 assert.equal(one.siteSetupCents,99000);
 assert.equal(one.siteInstallmentCents,33000);
 assert.equal(one.siteMonthlyCents,7990);
 assert.equal(one.contractedSetupAndActivationCents,99000);
 assert.equal(one.adManagementEstimateCents,0);
 assert.equal(one.hasChoice,true);
 assert.equal(one.eligibleForPublicCheckout,false);
 assert.equal(one.customerDataCaptured,false);
 const landing=buildCommercialChoicePreview({site:'landing-pages',channels:[],tier:'minimum'});
 assert.equal(landing.siteSetupCents,129000);
 assert.equal(landing.siteInstallmentCents,43000);
 assert.equal(landing.siteMonthlyCents,7990);
 assert.equal(landing.contractedSetupAndActivationCents,129000);
 assert.deepEqual(Object.keys(REVIEWED_SITE_CHOICES).sort(),['landing-pages','none','onepage']);
});

test('F324: media minimum applies management floor per channel, not to combined spend',()=>{
 const google=buildCommercialChoicePreview({site:'none',channels:['google_ads'],tier:'minimum'});
 assert.equal(google.adMediaCents,100000);
 assert.equal(google.adManagementEstimateCents,20000);
 assert.equal(google.adActivationCents,49000);
 const meta=buildCommercialChoicePreview({site:'none',channels:['meta_ads'],tier:'minimum'});
 assert.equal(meta.adMediaCents,70000);
 assert.equal(meta.adManagementEstimateCents,17000);
 assert.equal(meta.adActivationCents,49000);
 const both=buildCommercialChoicePreview({site:'none',channels:['google_ads','meta_ads'],tier:'minimum'});
 assert.equal(both.adManagementEstimateCents,37000);
 assert.equal(both.adActivationCents,98000);
 assert.equal(both.adMediaCents,170000);
 assert.equal(both.contractedSetupAndActivationCents,98000);
 assert.equal(both.actualManagementRequiresPostpaidVerification,true);
 assert.deepEqual(Object.keys(REVIEWED_CHANNEL_CHOICES).sort(),['google_ads','meta_ads']);
});

test('F324: recommended tier and website + ads composition remain separate',()=>{
 const result=buildCommercialChoicePreview({site:'landing-pages',channels:['meta_ads','google_ads'],tier:'recommended'});
 assert.equal(result.siteSetupCents,129000);
 assert.equal(result.siteInstallmentCents,43000);
 assert.equal(result.siteMonthlyCents,7990);
 assert.equal(result.adActivationCents,98000);
 assert.equal(result.adManagementEstimateCents,50000);
 assert.equal(result.adMediaCents,250000);
 assert.equal(result.contractedSetupAndActivationCents,227000);
 assert.deepEqual(result.adLines.map(x=>x.managementCents),[20000,30000]);
 assert.ok(Object.isFrozen(result));
 assert.ok(Object.isFrozen(result.channels));
 assert.ok(Object.isFrozen(result.adLines));
 const none=buildCommercialChoicePreview({site:'none',channels:[],tier:'minimum'});
 assert.equal(none.hasChoice,false);
 assert.equal(none.contractedSetupAndActivationCents,0);
});

test('F324: reject unsupported or duplicated choices and channels',()=>{
 for(const input of [
  null,{},[],{site:'__proto__',channels:[],tier:'minimum'},
  {site:'criacao-de-sites',channels:[],tier:'minimum'},
  {site:'onepage',channels:['chatgpt_ads'],tier:'minimum'},
  {site:'onepage',channels:['meta_ads','meta_ads'],tier:'minimum'},
  {site:'onepage',channels:['google_ads','meta_ads','chatgpt_ads'],tier:'minimum'},
  {site:'onepage',channels:['google_ads'],tier:'vip'},
  {site:'onepage',channels:'google_ads',tier:'recommended'}
 ])assert.throws(()=>buildCommercialChoicePreview(input));
});

test('F324: browser component is an anonymous click-only preview across PT EN ES',()=>{
 const component=read('src/components/CommercialChoicePreview.astro');
 const pt=read('src/components/QuickServiceRequest.astro');
 const international=read('src/components/InternationalSalesHome.astro');
 assert.match(pt,/<CommercialChoicePreview locale="pt-BR"\/>/);
 assert.match(international,/<CommercialChoicePreview locale=\{locale\}\/>/);
 assert.match(component,/data-choice-channel="google_ads"/);
 assert.match(component,/data-choice-channel="meta_ads"/);
 assert.match(component,/data-choice-site="landing-pages"/);
 assert.match(component,/data-choice-tier="minimum"/);
 assert.match(component,/data-choice-tier="recommended"/);
 assert.match(component,/href=\{contact\}/);
 assert.match(component,/eligibleForPublicCheckout|Simulação, não contratação|no public checkout|No hay compra pública activa/);
 assert.doesNotMatch(component,/<(?:form|input|textarea)\b|\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|innerHTML|document\.cookie|FormData|requestSubmit|\.submit\s*\(/);
 assert.ok(component.includes('aria-pressed'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 assessPublicPortalReadiness as assess,
 describePublicPortalReadiness as describe,
 REVIEWED_PORTAL_READINESS_CODES
} from '../src/lib/public-portal-checkout-readiness.mjs';
import {assessPrivatePortalChoice} from
 '../ops/review/purchase/portal-choice-handoff-gate.mjs';

const choice=(site,channels=[],tier='recommended')=>({site,channels,tier});
test('F348 all 48 public selections match the independent F327 private Portal scope',()=>{
 const counters=Object.fromEntries(REVIEWED_PORTAL_READINESS_CODES.map(k=>[k,0]));
 let n=0;
 for(const site of ['none','onepage','landing-pages'])
  for(const tier of ['minimum','recommended'])
   for(let mask=0;mask<8;mask++){
    const channels=['google_ads','meta_ads','chatgpt_ads']
      .filter((_,i)=>mask&(1<<i));
    const selection=choice(site,channels,tier);
    const assessment=assess(selection);
    counters[assessment.code]++;
    n++;
    assert.ok(Object.isFrozen(assessment));
    assert.equal(assessment.publicCheckoutAuthorized,false);
    assert.equal(assessment.automaticChargeAuthorized,false);
    assert.equal(assessment.portalLoginOrRedirectAuthorized,false);
    assert.equal(assessment.finalServerRepricingRequired,true);
    assert.equal(assessment.privateSinglePreviewEligible,
     assessment.code==='private_single_preview_only');
    if(channels.includes('chatgpt_ads')){
     assert.equal(assessment.code,'chatgpt_ads_not_in_portal_catalog');
     assert.throws(()=>assessPrivatePortalChoice(selection),/No reviewed private Portal mapping/);
    }else{
     assert.equal(assessment.code,
      assessPrivatePortalChoice(selection).code==='single_product_preview'
       ?'private_single_preview_only':assessPrivatePortalChoice(selection).code);
    }
    for(const lang of ['pt-BR','en','es']){
     const message=describe(selection,lang);
     assert.ok(message.length>=75,lang+': explain the boundary without a button');
     assert.doesNotMatch(message,/https?:\/\/|@|token=|customerId/i);
    }
   }
 assert.equal(n,48);
 assert.deepEqual(counters,{
  no_selection:2,private_single_preview_only:8,
  multi_product_cart_required:12,
  multi_channel_cart_required:2,
  chatgpt_ads_not_in_portal_catalog:24
 });
});

test('F348 visible statuses explain why single and composite quotes are not purchase-ready',()=>{
 for(const [site,channels,code] of [
  ['onepage',[],'private_single_preview_only'],
  ['landing-pages',['google_ads'],'multi_product_cart_required'],
  ['none',['google_ads','meta_ads'],'multi_channel_cart_required'],
  ['none',['chatgpt_ads'],'chatgpt_ads_not_in_portal_catalog'],
  ['none',[],'no_selection']
 ])assert.equal(assess(choice(site,channels)).code,code);
 const pt=describe(choice('none',['chatgpt_ads']),'pt-BR');
 assert.match(pt,/não está aprovado/);
 assert.match(pt,/não há checkout/);
 const single=describe(choice('onepage'),'pt-BR');
 assert.match(single,/contratação pública ainda não está disponível/);
 assert.throws(()=>describe(choice('onepage'),'fr'),/Unsupported public Portal readiness locale/);
 assert.throws(()=>assess({...choice('onepage'),tenantId:'PRIVATE'}),/Invalid quote selection/);
 assert.throws(()=>assess(choice('none',['chatgpt_ads','chatgpt_ads'])),/duplicate advertising channel/);
});

test('F348 server-rendered text and browser updates share the same strictly validated model',()=>{
 const component=readFileSync(new URL('../src/components/CommercialChoicePreview.astro',import.meta.url),'utf8');
 const pure=readFileSync(new URL('../src/lib/public-portal-checkout-readiness.mjs',import.meta.url),'utf8');
 assert.match(component,/data-choice-portal-readiness/);
 assert.match(component,/data-code=\{initialPortalReadiness\.code\}/);
 assert.match(component,/describePublicPortalReadiness\(initialReadinessSelection,locale\)/);
 assert.match(component,/describePublicPortalReadiness\(\{site,channels,tier\},locale\)/);
 assert.match(component,/setAttribute\('data-code',readiness\.code\)/);
 assert.doesNotMatch(pure,/fetch\s*\(|navigator|window\.|localStorage|sessionStorage|XMLHttpRequest|location\.href|http[s]?:\/\//);
 assert.doesNotMatch(component,/data-choice-portal-readiness[^>]*href=/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCommercialChoicePreview,REVIEWED_SITE_CHOICES,REVIEWED_CHANNEL_CHOICES,splitThreeIllustrativeInstallments,describeThreeIllustrativeInstallments} from '../src/lib/commercial-choice-preview.mjs';
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
 assert.deepEqual(Object.keys(REVIEWED_CHANNEL_CHOICES).sort(),['chatgpt_ads','google_ads','meta_ads']);
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
  {site:'onepage',channels:['unknown_ads'],tier:'minimum'},
  {site:'onepage',channels:['meta_ads','meta_ads'],tier:'minimum'},
  {site:'onepage',channels:['google_ads','meta_ads','chatgpt_ads','unknown_ads'],tier:'minimum'},
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
 assert.match(pt,/href="#simular-compra">Montar meu orçamento/);
 assert.match(international,/href="#simular-compra">\{copy\.flowAction\}/);
 assert.match(component,/href=\{initialHref\}/);
 assert.match(component,/target=\{onepagePreviewHref\?undefined:'_blank'\}/);
 assert.match(component,/rel=\{onepagePreviewHref\?'noreferrer nofollow':'noopener noreferrer'\}/);
 const browser=component.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(browser,'The selector script must remain reviewable');
 assert.doesNotMatch(browser,/ops\/review|portal-dev\.|reviewedCiOnly/,
  'Build-only authority and private origin must not enter the public browser bundle');
 assert.match(component,/reviewedQuoteChoiceHref\(locale,\{site,channels,tier\}\)/);
 assert.match(component,/eligibleForPublicCheckout|Simulação, não contratação|no public checkout|No hay compra pública activa/);
 assert.doesNotMatch(component,/<(?:form|input|textarea)\b|\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|innerHTML|document\.cookie|FormData|requestSubmit|\.submit\s*\(/);
 assert.ok(component.includes('aria-pressed'));
});

test('approved three-channel selector supports all 48 anonymous estimates without enabling checkout',()=>{
 for(const site of ['none','onepage','landing-pages'])for(const tier of ['minimum','recommended'])for(let mask=0;mask<8;mask++){
  const channels=['google_ads','meta_ads','chatgpt_ads'].filter((_,i)=>mask&(1<<i));
  const q=buildCommercialChoicePreview({site,channels,tier});
  assert.equal(q.adActivationCents,49000*channels.length);
  assert.equal(q.adMediaCents,q.adLines.reduce((sum,line)=>sum+line.mediaCents,0));
  assert.equal(q.eligibleForPublicCheckout,false);
  assert.equal(q.hasChoice,site!=='none'||channels.length>0);
 }
});


test('F341: anonymous quote rejects hidden PII, inherited choices and accessor side effects',()=>{
 const base=()=>({site:'onepage',channels:['google_ads'],tier:'recommended'});
 const extraField={...base(),tenantId:'private-tenant-123'};
 const nullProto=Object.assign(Object.create(null),base());
 assert.equal(buildCommercialChoicePreview(nullProto).adActivationCents,49000);
 assert.throws(()=>buildCommercialChoicePreview(extraField),/Invalid quote selection/);
 assert.throws(()=>buildCommercialChoicePreview(Object.create(base())),/Invalid quote selection/);
 const hidden=base();
 Object.defineProperty(hidden,'privateEmail',{value:'private@example.test'});
 assert.throws(()=>buildCommercialChoicePreview(hidden),/Invalid quote selection/);
 const withSymbol=base();
 withSymbol[Symbol('customer-secret')]='secret';
 assert.throws(()=>buildCommercialChoicePreview(withSymbol),/Invalid quote selection/);
 let getterCalls=0;
 const accessor=base();
 Object.defineProperty(accessor,'site',{enumerable:true,
  get(){getterCalls++;throw Error('getter should never execute');}
 });
 assert.throws(()=>buildCommercialChoicePreview(accessor),/Invalid quote selection/);
 assert.equal(getterCalls,0);
 const setter=base();
 Object.defineProperty(setter,'tier',{enumerable:true,get(){getterCalls++;return 'minimum';},set(){}});
 assert.throws(()=>buildCommercialChoicePreview(setter),/Invalid quote selection/);
 assert.equal(getterCalls,0);
});

test('F341: quote channel list must be dense ordinary own-data values, no traps or metadata',()=>{
 const base=channels=>({site:'none',channels,tier:'minimum'});
 const sparse=new Array(1);
 assert.throws(()=>buildCommercialChoicePreview(base(sparse)),/advertising channel/);
 const holes=['google_ads',,'meta_ads'];
 assert.throws(()=>buildCommercialChoicePreview(base(holes)),/advertising channel/);
 const accessor=['google_ads'];
 let getterCalls=0;
 Object.defineProperty(accessor,'0',{configurable:true,enumerable:true,
  get(){getterCalls++;throw Error('channel getter should never execute');}
 });
 assert.throws(()=>buildCommercialChoicePreview(base(accessor)),/advertising channel/);
 assert.equal(getterCalls,0);
 const hidden=['google_ads'];
 Object.defineProperty(hidden,'email',{value:'private@example.test'});
 assert.throws(()=>buildCommercialChoicePreview(base(hidden)),/advertising channel/);
 const withSymbol=['meta_ads'];
 withSymbol[Symbol('token')]='private';
 assert.throws(()=>buildCommercialChoicePreview(base(withSymbol)),/advertising channel/);
 const inherited=Object.assign([],['meta_ads']);
 Object.setPrototypeOf(inherited,Object.create(Array.prototype));
 assert.throws(()=>buildCommercialChoicePreview(base(inherited)),/advertising channel/);
 const valid=Object.freeze(['google_ads','meta_ads']);
 const estimate=buildCommercialChoicePreview(Object.freeze(base(valid)));
 assert.deepEqual(estimate.channels,['google_ads','meta_ads']);
 assert.equal(estimate.adActivationCents,98000);
 assert.equal(estimate.eligibleForPublicCheckout,false);
});


test('F345: all 48 public quote combinations add up to the exact advertised setup + activation',()=>{
 const names=['google_ads','meta_ads','chatgpt_ads'];
 let checked=0;
 for(const site of ['none','onepage','landing-pages'])
  for(const tier of ['minimum','recommended'])
   for(let mask=0;mask<8;mask++){
    const channels=names.filter((_,i)=>mask&(1<<i));
    const estimate=buildCommercialChoicePreview({site,channels,tier});
    const parts=splitThreeIllustrativeInstallments(estimate.contractedSetupAndActivationCents);
    assert.equal(parts.firstCents+parts.secondCents+parts.lastCents,estimate.contractedSetupAndActivationCents);
    assert.equal(parts.firstCents,parts.secondCents);
    assert.ok(parts.lastCents-parts.firstCents>=0);
    assert.ok(parts.lastCents-parts.firstCents<=2);
    assert.equal(parts.checkoutAuthorized,false);
    assert.ok(Object.isFrozen(parts));
    const displayed=describeThreeIllustrativeInstallments(
      estimate.contractedSetupAndActivationCents,'pt-BR');
    assert.ok(displayed.includes('R$ '));
    assert.ok(displayed.startsWith(parts.hasAdjustment?'2 × ':'3 × '));
    assert.equal(displayed.includes(' + 1 × '),parts.hasAdjustment);
    checked++;
   }
 assert.equal(checked,48);
});

test('F345: remainder is visible to visitors instead of 3x an understated cent amount',()=>{
 assert.deepEqual(splitThreeIllustrativeInstallments(148000),{
  firstCents:49333,secondCents:49333,lastCents:49334,
  totalCents:148000,hasAdjustment:true,checkoutAuthorized:false
 });
 assert.deepEqual(splitThreeIllustrativeInstallments(197000),{
  firstCents:65666,secondCents:65666,lastCents:65668,
  totalCents:197000,hasAdjustment:true,checkoutAuthorized:false
 });
 assert.equal(describeThreeIllustrativeInstallments(99000,'pt-BR'),'3 × R$ 330,00');
 assert.equal(describeThreeIllustrativeInstallments(148000,'pt-BR'),'2 × R$ 493,33 + 1 × R$ 493,34');
 assert.equal(describeThreeIllustrativeInstallments(197000,'pt-BR'),'2 × R$ 656,66 + 1 × R$ 656,68');
 assert.equal(describeThreeIllustrativeInstallments(148000,'en'),'2 × BRL 493.33 + 1 × BRL 493.34');
 assert.equal(describeThreeIllustrativeInstallments(148000,'es'),'2 × R$ 493,33 + 1 × R$ 493,34');
 for(const invalid of [-1,0.1,NaN,Infinity,-Infinity,'100',null,1_000_000_001,Number.MAX_SAFE_INTEGER])
  assert.throws(()=>splitThreeIllustrativeInstallments(invalid),/Invalid nonbinding amount/);
 assert.throws(()=>describeThreeIllustrativeInstallments(148000,'fr'),/Unsupported installment display locale/);
 const component=read('src/components/CommercialChoicePreview.astro');
 assert.match(component,/data-choice-onetime aria-live="polite"/);
 assert.match(component,/describeThreeIllustrativeInstallments\(initial\.contractedSetupAndActivationCents,locale\)/);
 assert.match(component,/describeThreeIllustrativeInstallments\(estimate\.contractedSetupAndActivationCents,locale\)/);
 assert.doesNotMatch(component,/Math\.floor\(estimate\.contractedSetupAndActivationCents\/3\)/);
});

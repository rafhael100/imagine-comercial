/**
 * F347 — 48-way real PHP Portal V5 pricing and checkout-scope verification.
 *
 * Runs only in local CI with pinned checkout of Portal V5. No network,
 * customer, tenant, credentials, persistence, PSP, invoice or live checkout.
 *
 * A mixed site+ads selection can be quoted in separate server-side catalog
 * components; this NEVER proves the Portal can sell them as one atomic cart.
 * The Portal owns final terms, authorizations, checkout and postpaid billing.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {existsSync} from 'node:fs';
import {
 buildCommercialChoicePreview,REVIEWED_CHANNEL_CHOICES,
 splitThreeIllustrativeInstallments
} from '../../../src/lib/commercial-choice-preview.mjs';
import {
 assessPrivatePortalChoice,reviewedCiOnlyChoiceHandoff
} from './portal-choice-handoff-gate.mjs';

assert.equal(process.argv.length,3,
 'F347: usage node test-portal-v5-full-selection-matrix.mjs <pinned-Portal-path>');
const portalCatalog=join(resolve(process.argv[2]),
 'apps/portal/app/Homologation/Commerce/ApprovedOfferCatalog.php');
assert.ok(existsSync(portalCatalog),'F347: pinned Portal V5 server catalog missing');

// All channel budgets are derived from reviewed JS catalog data, not copied
// from marketing HTML. The PHP implementation independently recalculates.
const channels=['google_ads','meta_ads','chatgpt_ads'];
const supported=['google_ads','meta_ads'];
const mediaCases=Object.fromEntries(['minimum','recommended'].flatMap(tier=>
 [1,2,3].map(mask=>{
  const names=supported.filter((_,i)=>mask&(1<<i));
  const media=Object.fromEntries(names.map(code=>[code,
   tier==='recommended'?REVIEWED_CHANNEL_CHOICES[code].recommendedMediaCents:
    REVIEWED_CHANNEL_CHOICES[code].minimumMediaCents]));
  return [tier+':'+mask,media];
 })
));
const php=String.raw`
require $argv[1];
$c=new App\Homologation\Commerce\ApprovedOfferCatalog();
$cases=json_decode($argv[2],true,512,JSON_THROW_ON_ERROR);
$quotes=[];
foreach ($cases as $case=>$media) $quotes[$case]=$c->quote('performance',$media);
$chatgptRejected=false;
try {
  $c->quote('performance',['chatgpt_ads'=>120000]);
} catch (\InvalidArgumentException $e) { $chatgptRejected=true; }
echo json_encode([
 'catalogVersion'=>$c->version(),
 'siteQuotes'=>[
  'onepage'=>$c->quote('onepage'),
  'landing-pages'=>$c->quote('landing-pages')
 ],
 'performanceQuotes'=>$quotes,
 'chatgptRejected'=>$chatgptRejected,
],JSON_THROW_ON_ERROR);
`;
let server;
try{
 server=JSON.parse(execFileSync('php',['-r',php,portalCatalog,
  JSON.stringify(mediaCases)],{
  encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024,
  stdio:['ignore','pipe','pipe']
 }));
}catch{
 throw Error('F347: pinned Portal PHP catalog execution failed; HOLD NO-CHECKOUT');
}
assert.match(server.catalogVersion,/^[0-9a-f]{64}$/);
assert.equal(server.chatgptRejected,true,'ChatGPT Ads is not approved in pinned Portal V5');
assert.equal(Object.keys(server.performanceQuotes).length,6);
const ci=Object.freeze({
 GITHUB_ACTIONS:'true',
 IMAGINE_PORTAL_CHOICE_HANDOFF_PREVIEW:'1'
});
const counters={
 selections:0,empty:0,portalSupportedSinglePreview:0,
 heldMultiProductCart:0,heldMultiChannelCart:0,
 heldUnapprovedChatgpt:0,priceParityComparisons:0,
 pricesMisrepresentedAsCheckout:0
};
for(const site of ['none','onepage','landing-pages'])
 for(const tier of ['minimum','recommended'])
  for(let mask=0;mask<8;mask++){
   counters.selections++;
   const selected=channels.filter((_,i)=>mask&(1<<i));
   const selection={site,channels:selected,tier};
   const estimate=buildCommercialChoicePreview(selection);
   const installments=splitThreeIllustrativeInstallments(
    estimate.contractedSetupAndActivationCents);
   assert.equal(installments.firstCents+installments.secondCents+
    installments.lastCents,estimate.contractedSetupAndActivationCents);
   assert.equal(estimate.customerDataCaptured,false);
   assert.equal(estimate.eligibleForPublicCheckout,false);
   assert.equal(installments.checkoutAuthorized,false);

   if(site!=='none'){
    const p=server.siteQuotes[site];
    assert.equal(p.catalog_version,server.catalogVersion);
    assert.equal(p.setup_total_cents,estimate.siteSetupCents);
    assert.equal(p.monthly.amount_cents,estimate.siteMonthlyCents);
    assert.equal(p.monthly.first_due_offset_days,90);
    assert.equal(p.monthly.anchor,'contract_acceptance');
    assert.equal(p.monthly.independent_of_publication,true);
    assert.equal(p.setup_charges.length,3);
    assert.equal(p.setup_charges.reduce((sum,x)=>sum+x.amount_cents,0),
     estimate.siteSetupCents);
    assert.equal(p.real_charge_enabled,false);
    counters.priceParityComparisons++;
   }

   if(selected.includes('chatgpt_ads')){
    // Marketing can discuss ChatGPT Ads planning, but pinned Portal V5
    // MUST reject it rather than drop it from a mixed product order.
    assert.throws(()=>assessPrivatePortalChoice(selection),
     /No reviewed private Portal mapping/);
    assert.throws(()=>reviewedCiOnlyChoiceHandoff(selection,ci),
     /No reviewed private Portal mapping/);
    counters.heldUnapprovedChatgpt++;
    continue;
   }

   if(selected.length){
    const channelMask=(selected.includes('google_ads')?1:0)+
     (selected.includes('meta_ads')?2:0);
    const p=server.performanceQuotes[tier+':'+channelMask];
    const media=mediaCases[tier+':'+channelMask];
    assert.deepEqual(p.media_by_channel_cents,media);
    assert.equal(p.catalog_version,server.catalogVersion);
    assert.equal(p.activation_total_cents,estimate.adActivationCents);
    assert.equal(p.estimated_management_fee_cents,
     estimate.adManagementEstimateCents);
    assert.equal(p.media_paid_directly_to_platforms,true);
    assert.equal(p.real_charge_enabled,false);
    assert.equal(p.real_postpaid_invoice_authorized,false);
    assert.equal(p.amount_now_cents,estimate.adActivationCents);
    assert.equal(p.activation_per_channel_cents,49000);
    assert.equal(p.minimum_management_fee_per_channel_cents,17000);
    counters.priceParityComparisons++;
   }

   const gate=assessPrivatePortalChoice(selection);
   const preview=reviewedCiOnlyChoiceHandoff(selection,ci);
   if(!estimate.hasChoice){
    assert.equal(gate.code,'no_selection');
    assert.equal(preview.canNavigate,false);
    assert.equal(preview.href,null);
    counters.empty++;
   }else if(site!=='none'&&selected.length){
    assert.equal(gate.code,'multi_product_cart_required');
    assert.equal(preview.canNavigate,false);
    assert.equal(preview.href,null);
    counters.heldMultiProductCart++;
   }else if(selected.length>1){
    assert.equal(gate.code,'multi_channel_cart_required');
    assert.equal(preview.canNavigate,false);
    assert.equal(preview.href,null);
    counters.heldMultiChannelCart++;
   }else{
    assert.equal(gate.code,'single_product_preview');
    assert.equal(preview.canNavigate,true);
    assert.equal(typeof preview.href,'string');
    assert.equal(new URL(preview.href).hostname,'portal-dev.imaginecomunica.com.br');
    assert.equal(new URL(preview.href).searchParams.has('amount'),false);
    assert.equal(new URL(preview.href).searchParams.has('customer'),false);
    assert.equal(new URL(preview.href).searchParams.has('tenant'),false);
    counters.portalSupportedSinglePreview++;
   }
  }
assert.deepEqual(counters,{
 selections:48,
 empty:2,
 portalSupportedSinglePreview:8,
 heldMultiProductCart:12,
 heldMultiChannelCart:2,
 heldUnapprovedChatgpt:24,
 priceParityComparisons:40,
 pricesMisrepresentedAsCheckout:0
});
assert.equal(counters.selections,counters.empty+counters.portalSupportedSinglePreview+
 counters.heldMultiProductCart+counters.heldMultiChannelCart+
 counters.heldUnapprovedChatgpt);
// A green financial parity check is NOT authorization for checkout,
// identity, agreement, automatic media charges or production deployment.
console.log(JSON.stringify({
 contractVersion:'comercial-f347-pinned-portal-v5-full-choice-matrix-v1',
 catalogSha256Verified:true,
 ...counters,
 portalPrivateCheckoutAuthenticated:false,
 atomicMultiProductCartImplemented:false,
 chatgptAdsPortalEligible:false,
 realPaymentAuthorized:false,
 realInvoiceAuthorized:false,
 productionDeploymentAuthorized:false,
 releaseStatus:'HOLD_PORTAL_MULTI_ITEM_AUTH_AND_HUMAN_RELEASE'
}));

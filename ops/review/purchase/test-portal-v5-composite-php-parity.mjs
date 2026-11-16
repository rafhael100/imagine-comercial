/**
 * F349 — run the actual isolated Portal composite PHP quote, pinned by SHA,
 * against all 48 public marketing selections without changing checkout.
 *
 * This lab always remains NO-GO: price parity is not customer identity,
 * tenant authorization, an atomic cart, a payment mandate or fiscal invoice.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {existsSync} from 'node:fs';
import {
 buildCommercialChoicePreview,splitThreeIllustrativeInstallments
} from '../../../src/lib/commercial-choice-preview.mjs';
import {assessPublicPortalReadiness} from
 '../../../src/lib/public-portal-checkout-readiness.mjs';

assert.equal(process.argv.length,3,'F349: pass pinned Portal checkout path');
const file=join(resolve(process.argv[2]),
 'apps/portal/app/Homologation/Commerce/CompositeQuotePreview.php');
assert.ok(existsSync(file),'F349: pinned PHP composite lab required');
const names=['google_ads','meta_ads','chatgpt_ads'];
const selections=[];
for(const site of ['none','onepage','landing-pages'])
 for(const tier of ['minimum','recommended'])
  for(let mask=0;mask<8;mask++)
   selections.push({site,channels:names.filter((_,i)=>mask&(1<<i)),tier});
assert.equal(selections.length,48);
const php=String.raw`
require $argv[1];
$engine=new App\\Homologation\\Commerce\\CompositeQuotePreview();
$selections=json_decode($argv[2],true,512,JSON_THROW_ON_ERROR);
$out=[];
foreach ($selections as $selected) {
  try {
    $out[]=['accepted'=>true,'quote'=>$engine->quote($selected)];
  } catch (\\InvalidArgumentException $e) {
    $out[]=['accepted'=>false];
  }
}
echo json_encode($out,JSON_THROW_ON_ERROR);
`;
let results;
try{
 results=JSON.parse(execFileSync('php',['-r',php,file,JSON.stringify(selections)],{
  encoding:'utf8',timeout:25000,maxBuffer:3*1024*1024,
  stdio:['ignore','pipe','pipe']
 }));
}catch{
 throw Error('F349: pinned Portal composite PHP parity failed; HOLD checkout');
}
assert.ok(Array.isArray(results)&&results.length===selections.length,
 'Portal must return exactly one reviewed result per anonymous selection');
const status={total:0,validPrivateCompositeCalculations:0,
 rejectedUnsupportedOrEmpty:0,compositeSiteAndAds:0,
 multipleAdChannels:0,privateSinglePreviewOnly:0};
for(let i=0;i<selections.length;i++){
 const selection=selections[i];
 const raw=results[i];
 const publicQuote=buildCommercialChoicePreview(selection);
 const readiness=assessPublicPortalReadiness(selection);
 const unsupported=selection.channels.includes('chatgpt_ads')||!publicQuote.hasChoice;
 status.total++;
 if(unsupported){
  assert.deepEqual(raw,{accepted:false},
   'Portal must reject unapproved ChatGPT Ads or empty selection without repricing');
  status.rejectedUnsupportedOrEmpty++;
  continue;
 }
 assert.equal(raw?.accepted,true,'Allowed site/Google/Meta must be quoted by PHP');
 const server=raw.quote;
 assert.equal(server.contract_version,'portal-composite-quote-v5-lab-v1');
 assert.match(server.catalog_version,/^[a-f0-9]{64}$/);
 assert.equal(server.currency,'BRL');
 assert.equal(server.site,selection.site);
 assert.deepEqual(server.channels,selection.channels);
 assert.equal(server.media_tier,selection.tier);
 assert.equal(server.site_setup_cents,publicQuote.siteSetupCents);
 assert.equal(server.advertising_activation_cents,publicQuote.adActivationCents);
 assert.equal(server.setup_activation_total_cents,
  publicQuote.contractedSetupAndActivationCents);
 assert.equal(server.site_monthly_cents,publicQuote.siteMonthlyCents);
 assert.equal(server.site_monthly_first_due_offset_days,
  selection.site==='none'?null:90);
 assert.equal(server.site_monthly_anchor,
  selection.site==='none'?null:'contract_acceptance');
 assert.equal(server.site_monthly_independent_of_publication,
  selection.site==='none'?null:true);
 assert.equal(server.media_paid_directly_to_platforms_cents,publicQuote.adMediaCents);
 assert.equal(server.management_estimate_postpaid_cents,
  publicQuote.adManagementEstimateCents);
 const installments=splitThreeIllustrativeInstallments(
  publicQuote.contractedSetupAndActivationCents);
 assert.deepEqual(server.illustrative_three_parts_cents,[
  installments.firstCents,installments.secondCents,installments.lastCents
 ]);
 assert.equal(server.catalog_server_recomputed,true);
 assert.equal(server.management_requires_actual_verified_media,true);
 for(const flag of [
  'single_product_checkout_created','atomic_multi_product_checkout_implemented',
  'atomic_multi_channel_checkout_implemented','payment_schedule_created',
  'customer_or_tenant_data_captured','contract_accepted','real_charge_enabled',
  'real_postpaid_invoice_authorized','public_checkout_authorized',
  'operator_approval_verified'
 ])assert.equal(server[flag],false,flag);
 assert.match(server.release_status,/^HOLD_/);
 assert.equal(readiness.publicCheckoutAuthorized,false);
 assert.equal(readiness.portalLoginOrRedirectAuthorized,false);
 if(readiness.code==='private_single_preview_only')
  status.privateSinglePreviewOnly++;
 if(readiness.code==='multi_product_cart_required')
  status.compositeSiteAndAds++;
 if(readiness.code==='multi_channel_cart_required')
  status.multipleAdChannels++;
 status.validPrivateCompositeCalculations++;
}
assert.deepEqual(status,{
 total:48,validPrivateCompositeCalculations:22,
 rejectedUnsupportedOrEmpty:26,compositeSiteAndAds:12,
 multipleAdChannels:2,privateSinglePreviewOnly:8
});
console.log(JSON.stringify({
 contractVersion:'comercial-f349-php-composite-48-choice-parity-v1',
 pinnedPortalClassExecuted:true,
 ...status,
 publicCheckoutAuthorized:false,
 paymentScheduled:false,
 customerOrTenantDataReceived:false,
 networkPerformed:false,
 releaseStatus:'HOLD_PORTAL_AUTHN_MULTI_ITEM_PSP_AND_HUMAN_APPROVAL'
}));

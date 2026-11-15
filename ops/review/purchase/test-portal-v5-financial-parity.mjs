/**
 * F324 — Portal V5 pricing parity. Read-only, local PHP using pinned GitHub
 * checkout; never accesses a Portal URL, PSP, database, customer, or secret.
 * Commercial values here are illustrative only, Portal quote is authoritative.
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {existsSync} from 'node:fs';
import {
 previewCommercialSelection,PREVIEW_CHANNELS,PREVIEW_SITES
} from '../../../src/lib/commercial-selection-preview.mjs';

assert.equal(process.argv.length,3,'Usage: node test-portal-v5-financial-parity.mjs <pinned Portal checkout>');
const path=join(resolve(process.argv[2]),'apps/portal/app/Homologation/Commerce/ApprovedOfferCatalog.php');
assert.ok(existsSync(path),'Pinned Portal V5 approved catalog PHP is missing');
const php=String.raw`
require $argv[1];
$c=new App\Homologation\Commerce\ApprovedOfferCatalog();
$offers=$c->offers();
$media=[
 'google'=>['google_ads'=>100000],
 'meta'=>['meta_ads'=>70000],
 'both'=>['google_ads'=>100000,'meta_ads'=>70000],
 'large_google'=>['google_ads'=>400000]
];
$quotes=[];
foreach ($media as $name=>$input) $quotes[$name]=$c->quote('performance',$input);
$reject_google700=false;
try {$c->quote('performance',['google_ads'=>70000]);} catch (InvalidArgumentException $e) {$reject_google700=true;}
$reject_chatgpt=false;
try {$c->quote('performance',['chatgpt_ads'=>120000]);} catch (InvalidArgumentException $e) {$reject_chatgpt=true;}
echo json_encode([
 'version'=>$c->version(),
 'sites'=>['onepage'=>$c->quote('onepage'),'landing-pages'=>$c->quote('landing-pages')],
 'performance_policy'=>$offers['performance'],
 'quotes'=>$quotes,
 'reject_google700'=>$reject_google700,
 'reject_chatgpt'=>$reject_chatgpt
],JSON_THROW_ON_ERROR);
`;
let portal;
try{
 portal=JSON.parse(execFileSync('php',['-r',php,path],{
  encoding:'utf8',timeout:15000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']
 }));
}catch{
 throw Error('Pinned Portal V5 PHP quote execution failed: BLOCK promotion; no checkout or money');
}
assert.match(portal.version,/^[a-f0-9]{64}$/);
assert.equal(portal.performance_policy.pricing_policy,'performance-postpaid-170-per-channel-2026-11-14');
assert.equal(portal.performance_policy.direct_checkout_enabled,false);
for(const code of Object.keys(PREVIEW_CHANNELS)){
 assert.equal(portal.performance_policy.minimum_media_investment_by_channel_cents[code],
  PREVIEW_CHANNELS[code].minimumMediaCents,'Minimum media drift for '+code);
 assert.equal(portal.performance_policy.recommended_media_investment_by_channel_cents[code],
  PREVIEW_CHANNELS[code].recommendedMediaCents,'Recommended media drift for '+code);
}
for(const offer of Object.keys(PREVIEW_SITES)){
 const preview=previewCommercialSelection({offer});
 const p=portal.sites[offer];
 assert.equal(p.setup_total_cents,preview.setupCents);
 assert.equal(p.setup_charges.length,preview.installmentCount);
 assert.deepEqual(p.setup_charges.map(x=>x.amount_cents),
  Array(preview.installmentCount).fill(preview.installmentCents));
 assert.equal(p.monthly.amount_cents,preview.monthlyCents);
 assert.equal(p.monthly.first_due_offset_days,preview.firstMonthlyAfterDays);
 assert.equal(p.monthly.anchor,'contract_acceptance');
 assert.equal(p.monthly.independent_of_publication,true);
 assert.equal(p.real_charge_enabled,false);
 assert.equal(preview.realChargeEnabled,false);
}
for(const [name,channels] of Object.entries({
 google:{google_ads:100000},meta:{meta_ads:70000},
 both:{google_ads:100000,meta_ads:70000},large_google:{google_ads:400000}
})){
 const preview=previewCommercialSelection({offer:'performance',channels});
 const p=portal.quotes[name];
 assert.equal(p.activation_total_cents,preview.activationCents,name+' activation mismatch');
 assert.equal(p.estimated_management_fee_cents,preview.estimatedMonthlyManagementCents,name+' management mismatch');
 assert.deepEqual(p.media_by_channel_cents,channels,name+' media selection mismatch');
 assert.equal(p.minimum_management_fee_per_channel_cents,preview.minimumMonthlyManagementPerChannelCents);
 assert.equal(p.activation_per_channel_cents,49000);
 assert.equal(p.management_fee_basis_points,2000);
 assert.equal(p.real_charge_enabled,false);
 assert.equal(p.real_postpaid_invoice_authorized,false);
 assert.equal(preview.paymentNowCents,null);
 assert.equal(preview.requiresPortalRecalculation,true);
}
assert.equal(portal.reject_google700,true);
assert.equal(portal.reject_chatgpt,true);
console.log('PASS F324 Comercial preview vs PINNED Portal V5 (sites, media floors, activation, monthly estimated management). NO GO / NO CHARGE');

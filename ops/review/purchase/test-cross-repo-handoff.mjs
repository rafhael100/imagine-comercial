/**
 * Read-only cross-repository compatibility check.
 * Portal is checked out by CI at an immutable reviewed commit. No network calls.
 */
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {resolve,join} from "node:path";
import {existsSync} from "node:fs";
import {REVIEWED_OFFERS, reviewedPrivatePortalUrl} from "./private-portal-handoff-policy.mjs";

assert.equal(process.argv.length,3,"Usage: node test-cross-repo-handoff.mjs <Portal checkout>");
const root=resolve(process.argv[2]);
const helper=join(root,"apps/portal/app/Homologation/Commerce/CustomerPreviewHandoff.php");
const catalog=join(root,"apps/portal/app/Homologation/Commerce/ApprovedOfferCatalog.php");
for(const p of [helper,catalog]) assert.ok(existsSync(p),"Pinned Portal source missing");
const php=String.raw`
require $argv[1];
require $argv[2];
$h='App\\Homologation\\Commerce\\CustomerPreviewHandoff';
$c=new App\\Homologation\\Commerce\\ApprovedOfferCatalog();
$cases=[
  'onepage'=>['onepage',null],
  'landing-pages'=>['landing-pages',null],
  'gestao-google-ads'=>['performance','google_ads'],
  'gestao-meta-ads'=>['performance','meta_ads']
];
$paths=[];
foreach($cases as $slug=>$params) $paths[$slug]=$h::shopUrl(...$params);
$rejected=false;
try {$h::channel('performance','evil');} catch (InvalidArgumentException) {$rejected=true;}
$g=$c->quote('performance',['google_ads'=>70000]);
$m=$c->quote('performance',['meta_ads'=>70000]);
$both=$c->quote('performance',['google_ads'=>70000,'meta_ads'=>70000]);
echo json_encode(['paths'=>$paths,'rejected'=>$rejected,
 'setup_onepage'=>$c->quote('onepage')['setup_total_cents'],
 'setup_landing'=>$c->quote('landing-pages')['setup_total_cents'],
 'fee_google'=>$g['estimated_management_fee_cents'],
 'fee_meta'=>$m['estimated_management_fee_cents'],
 'fee_both'=>$both['estimated_management_fee_cents'],
 'real_charge_enabled'=>$both['real_charge_enabled'],
 'amount_now'=>$both['amount_now_cents']], JSON_THROW_ON_ERROR);
`;
let result;
try {
  result=JSON.parse(execFileSync("php",["-r",php,helper,catalog],{encoding:"utf8",timeout:15000,stdio:["ignore","pipe","pipe"],maxBuffer:256*1024}));
} catch {
  throw new Error("Pinned Portal compatibility test failed; no link or pricing can be promoted");
}
for(const slug of Object.keys(REVIEWED_OFFERS)){
  const url=new URL(reviewedPrivatePortalUrl(slug));
  assert.equal(url.pathname+url.search,result.paths[slug],"Cross-repo URL mismatch: "+slug);
  assert.equal(url.protocol,"https:");
}
assert.equal(result.rejected,true);
assert.equal(result.setup_onepage,99000);
assert.equal(result.setup_landing,129000);
assert.equal(result.fee_google,14000);
assert.equal(result.fee_meta,14000);
assert.equal(result.fee_both,28000);
assert.equal(result.real_charge_enabled,false);
assert.equal(result.amount_now,null);
console.log("PASS exact 4 Comercial URLs against pinned Portal PHP + price authority; NO BILLING / NO DEPLOY");

/**
 * Verify CI-only native Astro HTML before/after explicit private preview flag.
 * No browser navigation, network call, customer input or deployment.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,join} from "node:path";
assert.equal(process.argv.length,4,"Usage: test-native-astro-preview.mjs <dist> <public|private>");
const dir=resolve(process.argv[2]), phase=process.argv[3];
assert.ok(["public","private"].includes(phase));
const html=readFileSync(join(dir,"index.html"),"utf8");
const base="https://portal-dev.imaginecomunica.com.br/_preview/portal/shop?product=";
const expected={
  onepage: base+"onepage",
  "landing-pages": base+"landing-pages",
  "gestao-google-ads": base+"performance&channel=google_ads",
  "gestao-meta-ads": base+"performance&channel=meta_ads"
};
const six=["criacao-de-sites","landing-pages","onepage","sites-por-assinatura","gestao-google-ads","gestao-meta-ads"];
const attrs={};
for(const slug of six){
  const card=html.match(new RegExp('<article\\b[^>]*data-quick-hire="'+slug+'"[^>]*>[\\s\\S]*?<\\/article>'))?.[0];
  assert.ok(card,"Missing service "+slug);
  const matches=[...card.matchAll(/<a\b[^>]*data-quick-hire-action[^>]*>/g)];
  assert.equal(matches.length,1,"One CTA per service: "+slug);
  attrs[slug]=matches[0][0];
}
if(phase==="public"){
  assert.ok(!html.includes("portal-dev.imaginecomunica.com.br"),"Public build must never expose preview origin");
  assert.ok(!html.includes("Prévia privada de contratação"));
  for(const slug of six){
    assert.ok(attrs[slug].includes('target="_blank"'),"Public CTA remains WhatsApp: "+slug);
    assert.ok(attrs[slug].includes('rel="noopener noreferrer"'),"Public external link safe: "+slug);
  }
} else {
  assert.ok(html.includes("Prévia privada de contratação"),"Private disclaimer required");
  for(const [slug,url] of Object.entries(expected)){
    // Astro HTML-escapes query ampersands inside attributes. Compare encoded output.
    const htmlUrl=url.replaceAll("&","&amp;");
    assert.ok(attrs[slug].includes('href="'+htmlUrl+'"'),"Native Astro CTA mismatch: "+slug);
    assert.ok(!attrs[slug].includes('target="_blank"'),"Private CTA stays same tab");
    assert.ok(attrs[slug].includes('rel="noreferrer nofollow"'));
  }
  for(const slug of ["criacao-de-sites","sites-por-assinatura"]){
    assert.ok(attrs[slug].includes('target="_blank"'),"No Portal purchase mapping for "+slug);
  }
  assert.ok(!html.includes("asaas-access-token")&&!html.includes("access_token:"));
}
assert.ok(html.includes('class="hero hero-main"'),"Approved hero must remain present");
console.log("PASS native Astro "+phase+" CTAs; no traffic or publication");

import test from "node:test";
import assert from "node:assert/strict";
import { REVIEWED_OFFERS, REVIEWED_CHANNELS, reviewedPrivatePortalUrl, checkPrivatePortalUrl } from "../ops/review/purchase/private-portal-handoff-policy.mjs";

test("exact reviewed CTA links only, no extra parameters", () => {
  for (const slug of Object.keys(REVIEWED_OFFERS)) {
    const url=reviewedPrivatePortalUrl(slug);
    assert.equal(checkPrivatePortalUrl(url,slug),true);
    assert.equal(new URL(url).searchParams.get("product"),REVIEWED_OFFERS[slug]);
    assert.equal(new URL(url).searchParams.get("channel"),REVIEWED_CHANNELS[slug]??null);
    for(const bad of [url+"&price=0",url+"&channel=meta_ads",url+"#x",url.replace("https:","http:"),
      url.replace("portal-dev.imaginecomunica.com.br","evil.example"),
      url.replace("product=","redirect=")]) {
      assert.equal(checkPrivatePortalUrl(bad,slug),false);
    }
  }
});
test("Google and Meta context differs, but the product and financial authority remain Portal-owned", () => {
  const google=reviewedPrivatePortalUrl("gestao-google-ads");
  const meta=reviewedPrivatePortalUrl("gestao-meta-ads");
  assert.notEqual(google,meta);
  assert.equal(new URL(google).searchParams.get("product"),"performance");
  assert.equal(new URL(meta).searchParams.get("product"),"performance");
  assert.equal(new URL(google).searchParams.get("channel"),"google_ads");
  assert.equal(new URL(meta).searchParams.get("channel"),"meta_ads");
  for(const url of [google,meta]) {
    assert.equal(new URL(url).searchParams.has("amount"),false);
    assert.equal(new URL(url).searchParams.has("price"),false);
    assert.equal(new URL(url).searchParams.has("owner"),false);
  }
});
test("unknown product identifiers fail closed", () => {
  for (const slug of ["", "performance", "gestao-tiktok-ads", "__proto__", "../login", null, 2]) {
    assert.throws(()=>reviewedPrivatePortalUrl(slug));
    assert.equal(checkPrivatePortalUrl("https://portal-dev.imaginecomunica.com.br/_preview/portal/shop?product=performance",slug),false);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { REVIEWED_OFFERS, reviewedPrivatePortalUrl, checkPrivatePortalUrl } from "../ops/review/purchase/private-portal-handoff-policy.mjs";

test("exact reviewed CTA links only, no extra parameters", () => {
  for (const slug of Object.keys(REVIEWED_OFFERS)) {
    const url=reviewedPrivatePortalUrl(slug);
    assert.equal(checkPrivatePortalUrl(url,slug),true);
    assert.equal(new URL(url).searchParams.get("product"),REVIEWED_OFFERS[slug]);
    for(const bad of [url+"&price=0",url+"#x",url.replace("https:","http:"),
      url.replace("portal-dev.imaginecomunica.com.br","evil.example"),
      url.replace("product=","redirect=")]) {
      assert.equal(checkPrivatePortalUrl(bad,slug),false);
    }
  }
});
test("Google and Meta currently use a single performance product, not channel-based billing", () => {
  assert.equal(reviewedPrivatePortalUrl("gestao-google-ads"), reviewedPrivatePortalUrl("gestao-meta-ads"));
});
test("unknown product identifiers fail closed", () => {
  for (const slug of ["", "performance", "gestao-tiktok-ads", "__proto__", "../login", null, 2]) {
    assert.throws(()=>reviewedPrivatePortalUrl(slug));
    assert.equal(checkPrivatePortalUrl("https://portal-dev.imaginecomunica.com.br/_preview/portal/shop?product=performance",slug),false);
  }
});

/**
 * Strict, offline Comercial -> Portal PRIVATE preview link contract.
 * No browser redirects, no PSP requests, no production authorization.
 * Product identifiers are owned by the Portal; never accept arbitrary URLs.
 */
const BASE = "https://portal-dev.imaginecomunica.com.br/_preview/portal/shop";
export const REVIEWED_OFFERS = Object.freeze({
  onepage: "onepage",
  "landing-pages": "landing-pages",
  "gestao-google-ads": "performance",
  "gestao-meta-ads": "performance"
});
export const REVIEWED_CHANNELS = Object.freeze({
  "gestao-google-ads": "google_ads",
  "gestao-meta-ads": "meta_ads"
});
export function reviewedPrivatePortalUrl(slug) {
  if (typeof slug !== "string" || !Object.hasOwn(REVIEWED_OFFERS,slug)) {
    throw new TypeError("Unreviewed commercial offer");
  }
  const url = new URL(BASE);
  url.searchParams.set("product", REVIEWED_OFFERS[slug]);
  if (Object.hasOwn(REVIEWED_CHANNELS, slug)) url.searchParams.set("channel", REVIEWED_CHANNELS[slug]);
  return url.href;
}
export function checkPrivatePortalUrl(value,slug) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.href === reviewedPrivatePortalUrl(slug) &&
      url.protocol === "https:" && url.username === "" && url.password === "" &&
      url.hash === "" && url.searchParams.size === (Object.hasOwn(REVIEWED_CHANNELS, slug) ? 2 : 1);
  } catch { return false; }
}

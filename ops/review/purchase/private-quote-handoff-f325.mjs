/**
 * F325 — private CI-only Comercial -> Portal quote-choice handoff.
 * This is a navigational hint, not a signed authorization or a price.
 * The Portal's PHP catalog owns all actual quote numbers and can reject
 * stale/malformed params. Never publish this host into public HTML/JS.
 */
import {buildCommercialChoicePreview} from '../../../src/lib/commercial-choice-preview.mjs';
export const REVIEWED_PRIVATE_QUOTE_BASE=
  'https://portal-dev.imaginecomunica.com.br/_preview/portal/shop';

/** Canonical, price-free, finite query; no customer fields, secrets or tokens. */
export function reviewedPrivateQuoteHandoffUrl(selection) {
  const preview=buildCommercialChoicePreview(selection);
  if(!preview.hasChoice)throw new TypeError('Empty quote selection cannot proceed');
  const url=new URL(REVIEWED_PRIVATE_QUOTE_BASE);
  url.searchParams.set('site',preview.site);
  // Same strict canonical sort required by the Portal F426 parser.
  url.searchParams.set('channels',[...preview.channels].sort().join(','));
  url.searchParams.set('tier',preview.tier);
  return url.href;
}
export function checkReviewedPrivateQuoteHandoffUrl(url,selection){
  if(typeof url!=='string'||url.length>350)return false;
  try{
    const u=new URL(url);
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&
      u.searchParams.size===3&&u.href===reviewedPrivateQuoteHandoffUrl(selection);
  }catch{return false;}
}
export function isPrivateQuotePreviewBuild(env=process.env){
  return env?.GITHUB_ACTIONS==='true' &&
    env?.IMAGINE_ASTRO_PRIVATE_PORTAL_PREVIEW==='1' &&
    env?.IMAGINE_RELEASE_TARGET!=='production';
}

/**
 * F327: conservative mapping of anonymous Comercial selections to the
 * EXISTING four Portal PRIVATE checkout preview entrypoints.
 *
 * This is an OPS/CI module, never bundled into the public Astro site.
 * A mixed site + ads or two-channel cart CANNOT be silently reduced to one
 * product; it must wait for a server-owned multi-item checkout contract.
 */
import {buildCommercialChoicePreview} from '../../../src/lib/commercial-choice-preview.mjs';
import {reviewedPrivatePortalUrl,checkPrivatePortalUrl} from './private-portal-handoff-policy.mjs';

const CHANNEL_TO_SLUG=Object.freeze({
 google_ads:'gestao-google-ads',
 meta_ads:'gestao-meta-ads'
});

function decision(selection){
 const estimate=buildCommercialChoicePreview(selection);
 if(estimate.channels.some(channel=>!Object.hasOwn(CHANNEL_TO_SLUG,channel)))throw Error('No reviewed private Portal mapping');
 if(!estimate.hasChoice)return Object.freeze({
  code:'no_selection',supported:false,slug:null,
  reason:'Select a reviewed product before continuing'
 });
 if(estimate.site!=='none'&&estimate.channels.length>0)return Object.freeze({
  code:'multi_product_cart_required',supported:false,slug:null,
  reason:'Portal must accept and reprice website plus advertising atomically'
 });
 if(estimate.channels.length>1)return Object.freeze({
  code:'multi_channel_cart_required',supported:false,slug:null,
  reason:'Portal must preserve both selected channels after login'
 });
 const slug=estimate.site!=='none'?estimate.site:CHANNEL_TO_SLUG[estimate.channels[0]];
 if(typeof slug!=='string')throw Error('No reviewed private Portal mapping');
 return Object.freeze({
  code:'single_product_preview',supported:true,slug,
  reason:'Single product context only; Portal recalculates after authentication'
 });
}

/** Pure decision without private URLs, suitable for CI diagnostics. */
export function assessPrivatePortalChoice(selection) {
 return decision(selection);
}

/**
 * Strict opt-in for GitHub CI fixture ONLY. No browser-facing auto-redirect,
 * no price, amount, CNPJ, customer or tracking data in URL.
 * @param {object} selection  Reviewed anonymous selection.
 * @param {object} env  CI process env, injectable in unit tests only.
 */
export function reviewedCiOnlyChoiceHandoff(selection,env=process.env){
 const result=decision(selection);
 if(!env||env.GITHUB_ACTIONS!=='true'||
    env.IMAGINE_PORTAL_CHOICE_HANDOFF_PREVIEW!=='1'){
  return Object.freeze({...result,href:null,canNavigate:false,code:'ci_preview_disabled'});
 }
 if(!result.supported)
  return Object.freeze({...result,href:null,canNavigate:false});
 const href=reviewedPrivatePortalUrl(result.slug);
 if(!checkPrivatePortalUrl(href,result.slug))throw Error('Private Portal allowlist mismatch');
 const url=new URL(href);
 if([...url.searchParams.keys()].some(key=>!['product','channel'].includes(key)))
  throw Error('Unsafe private handoff parameter');
 return Object.freeze({...result,href,canNavigate:true});
}

/**
 * Server/build-only capability for the existing selector's Onepage entry.
 * Both private-preview opt-ins are required. This never widens the selector
 * to Landing Page, advertising or a combined cart and contains no prices.
 */
export function reviewedCiOnlyOnepageSelectorHref(env=process.env){
 if(!env||env.IMAGINE_ASTRO_PRIVATE_PORTAL_PREVIEW!=='1')return null;
 const handoff=reviewedCiOnlyChoiceHandoff(
  {site:'onepage',channels:[],tier:'recommended'},env
 );
 return handoff.canNavigate?handoff.href:null;
}

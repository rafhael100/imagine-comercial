/**
 * F324: deterministic commercial *estimate*, never an order or payment request.
 * Onepage/Landing values follow the reviewed Portal sandbox catalog.
 * Ad spend thresholds are Imagine's public editorial planning parameters;
 * the Portal remains the sole authority for final contracted terms.
 *
 * All monetary calculations use integer Brazilian centavos.
 */
import {PREVIEW_SITES, PREVIEW_CHANNELS} from './commercial-selection-preview.mjs';
import {CHANNELS,ONE_TIME_ACTIVATION_PER_CHANNEL_CENTS,illustrateFullMonthManagementCents,MONTHLY_MANAGEMENT_MINIMUM_PER_CHANNEL_CENTS} from './media-budget-calculator.mjs';

// F326: one reviewed source for both the public selector and Portal V5 parity.
// No copy-pasted site prices or channel floors in the browser component.
export const REVIEWED_SITE_CHOICES=Object.freeze({
  none:Object.freeze({setupCents:0,installmentCents:0,monthlyCents:0}),
  ...Object.fromEntries(Object.entries(PREVIEW_SITES).map(([code,policy])=>
    [code,Object.freeze({setupCents:policy.setupCents,installmentCents:policy.installmentCents,
     monthlyCents:policy.monthlyCents})]))
});
export const REVIEWED_CHANNEL_CHOICES=Object.freeze(Object.fromEntries(
  Object.entries({...PREVIEW_CHANNELS,chatgpt_ads:{minimumMediaCents:CHANNELS.chatgpt_ads.floorCents,recommendedMediaCents:CHANNELS.chatgpt_ads.recommendedCents,activationCents:ONE_TIME_ACTIVATION_PER_CHANNEL_CENTS}}).map(([code,policy])=>
    [code,Object.freeze({
      minimumMediaCents:policy.minimumMediaCents,recommendedMediaCents:policy.recommendedMediaCents,
      activationCents:policy.activationCents,
      managementFloorCents:MONTHLY_MANAGEMENT_MINIMUM_PER_CHANNEL_CENTS
    })])
));
export const REVIEWED_ESTIMATE_TIERS=Object.freeze(['minimum','recommended']);

/**
 * @param {{site:string,channels:string[],tier:string}} selection
 * @returns {Readonly<object>} An ephemeral estimate, without private data or side effects.
 */
export function buildCommercialChoicePreview(selection){
  if(!selection||typeof selection!=='object'||Array.isArray(selection))
    throw new TypeError('Invalid quote selection');
  const {site,channels,tier}=selection;
  if(typeof site!=='string'||!Object.hasOwn(REVIEWED_SITE_CHOICES,site))
    throw new TypeError('Unreviewed site choice');
  if(!Array.isArray(channels)||channels.length>3||
    channels.some(channel=>typeof channel!=='string'||!Object.hasOwn(REVIEWED_CHANNEL_CHOICES,channel))||
    new Set(channels).size!==channels.length)
    throw new TypeError('Unreviewed or duplicate advertising channel');
  if(!REVIEWED_ESTIMATE_TIERS.includes(tier))throw new TypeError('Unreviewed media tier');
  const sitePricing=REVIEWED_SITE_CHOICES[site];
  const adLines=channels.map(channel=>{
    const policy=REVIEWED_CHANNEL_CHOICES[channel];
    const mediaCents=tier==='recommended'?policy.recommendedMediaCents:policy.minimumMediaCents;
    const managementCents=illustrateFullMonthManagementCents(mediaCents);
    return Object.freeze({
      channel,mediaCents,activationCents:policy.activationCents,managementCents
    });
  });
  const total=(field)=>adLines.reduce((acc,line)=>acc+line[field],0);
  return Object.freeze({
    site,tier,channels:Object.freeze([...channels]),adLines:Object.freeze(adLines),
    siteSetupCents:sitePricing.setupCents,
    siteInstallmentCents:sitePricing.installmentCents,
    siteMonthlyCents:sitePricing.monthlyCents,
    adActivationCents:total('activationCents'),
    adMediaCents:total('mediaCents'),
    adManagementEstimateCents:total('managementCents'),
    contractedSetupAndActivationCents:sitePricing.setupCents+total('activationCents'),
    hasChoice:site!=='none'||channels.length>0,
    eligibleForPublicCheckout:false,
    customerDataCaptured:false,
    actualManagementRequiresPostpaidVerification:true
  });
}

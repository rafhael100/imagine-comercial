/**
 * F324: deterministic commercial *estimate*, never an order or payment request.
 * Site Onepage/Landing values follow the reviewed Portal sandbox catalog.
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
 * F345 — exact three-part *illustrative* schedule in whole BRL cents.
 * The last installment receives any 1–2-cent remainder. Never convert
 * a fractional BRL amount to a payable or customer-specific invoice.
 */
export function splitThreeIllustrativeInstallments(totalCents){
 if(!Number.isSafeInteger(totalCents)||totalCents<0||
    totalCents>1_000_000_000)
  throw new RangeError('Invalid nonbinding amount in cents');
 const regular=Math.floor(totalCents/3);
 const last=totalCents-regular*2;
 return Object.freeze({
  firstCents:regular,secondCents:regular,lastCents:last,
  totalCents,hasAdjustment:last!==regular,
  checkoutAuthorized:false
 });
}
export function describeThreeIllustrativeInstallments(totalCents,locale='pt-BR'){
 if(!['pt-BR','en','es'].includes(locale))
  throw new TypeError('Unsupported installment display locale');
 const split=splitThreeIllustrativeInstallments(totalCents);
 const currency=cents=>(locale==='en'?'BRL ':'R$ ')+
  (cents/100).toLocaleString(locale==='en'?'en-US':'pt-BR',{
   minimumFractionDigits:2,maximumFractionDigits:2
  });
 return split.hasAdjustment
  ?'2 × '+currency(split.firstCents)+' + 1 × '+currency(split.lastCents)
  :'3 × '+currency(split.firstCents);
}


// F341: the browser quote estimate is public-only and must not accidentally
// evaluate hidden PII, accessors or prototype-supplied choices. This is an
// in-process data contract, NOT a production checkout authorization.
const SELECTION_FIELDS=new Set(['site','channels','tier']);
function reviewedSelectionRecord(value){
 if(value===null||typeof value!=='object'||Array.isArray(value)||
    (Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))
   return false;
 const keys=Reflect.ownKeys(value);
 return keys.length===SELECTION_FIELDS.size&&keys.every(key=>{
  if(typeof key!=='string'||!SELECTION_FIELDS.has(key))return false;
  const desc=Object.getOwnPropertyDescriptor(value,key);
  return desc?.enumerable===true&&Object.hasOwn(desc,'value');
 });
}
function reviewedChannelArray(channels){
 if(!Array.isArray(channels)||Object.getPrototypeOf(channels)!==Array.prototype||
    channels.length>3||Reflect.ownKeys(channels).length!==channels.length+1)
   return false;
 for(let i=0;i<channels.length;i++){
  const descriptor=Object.getOwnPropertyDescriptor(channels,String(i));
  if(descriptor?.enumerable!==true||!Object.hasOwn(descriptor,'value')||
     typeof descriptor.value!=='string'||
     !Object.hasOwn(REVIEWED_CHANNEL_CHOICES,descriptor.value))
   return false;
 }
 return true;
}


/**
 * @param {{site:string,channels:string[],tier:string}} selection
 * @returns {Readonly<object>} An ephemeral estimate, without private data or side effects.
 */
export function buildCommercialChoicePreview(selection){
  if(!reviewedSelectionRecord(selection))
    throw new TypeError('Invalid quote selection');
  const {site,channels,tier}=selection;
  if(typeof site!=='string'||!Object.hasOwn(REVIEWED_SITE_CHOICES,site))
    throw new TypeError('Unreviewed site choice');
  if(!reviewedChannelArray(channels)||
    new Set(channels).size!==channels.length)
    throw new TypeError('Unreviewed or duplicate advertising channel');
  if(typeof tier!=='string'||!REVIEWED_ESTIMATE_TIERS.includes(tier))
    throw new TypeError('Unreviewed media tier');
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

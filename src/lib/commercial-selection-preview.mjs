/**
 * F324 — simulador P0 de escolha antes do cadastro. Dados sintéticos,
 * em centavos, sem cliente, CRM, PSP, rede, tokens ou preço assinável.
 * O Portal continua sendo a única autoridade financeira do checkout.
 *
 * Contrato: media = cliente paga diretamente à plataforma;
 * ativacao = uma vez por canal; gestao = estimativa mensal pós-paga
 * (20% da mídia EFETIVA, mínimo R$170/canal, mês civil completo).
 */
import {
  CHANNELS,ONE_TIME_ACTIVATION_PER_CHANNEL_CENTS,
  MONTHLY_MANAGEMENT_MINIMUM_PER_CHANNEL_CENTS,MONTHLY_MANAGEMENT_RATE_PERCENT,
  illustrateFullMonthManagementCents
} from './media-budget-calculator.mjs';
const REVIEWED_CHANNELS = Object.freeze(['google_ads','meta_ads']);
export const PREVIEW_CHANNELS = Object.freeze(Object.fromEntries(
  REVIEWED_CHANNELS.map(code=>[code,Object.freeze({
    minimumMediaCents:CHANNELS[code].floorCents,
    recommendedMediaCents:CHANNELS[code].recommendedCents,
    activationCents:ONE_TIME_ACTIVATION_PER_CHANNEL_CENTS
  })])
));
export const PREVIEW_SITES = Object.freeze({
  onepage: Object.freeze({setupCents:99000,installments:3,installmentCents:33000,monthlyCents:7990,firstMonthlyAfterDays:90}),
  'landing-pages': Object.freeze({setupCents:129000,installments:3,installmentCents:43000,monthlyCents:7990,firstMonthlyAfterDays:90})
});
export const PREVIEW_POLICY = 'imagine-comercial-f324-estimate-only-2026-11-14';

const fail = reason => { throw new TypeError('F324: '+reason); };
const plainObject = obj => obj !== null && typeof obj === 'object' &&
  (Object.getPrototypeOf(obj) === Object.prototype || Object.getPrototypeOf(obj) === null);
const hasOnlyKeys = (value,allowed) => Object.keys(value).every(k=>allowed.includes(k));
const amount = (cents,label) => {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 100000000) fail('Invalid '+label+' in cents');
  return cents;
};
const frozen = value => Object.freeze(value);
function common(offer) {
  return {
    offer,policy:PREVIEW_POLICY,displayCurrency:'BRL',
    estimatedOnly:true,realChargeEnabled:false,checkoutAuthorized:false,
    contractAccepted:false,paymentNowCents:null,
    requiresPortalRecalculation:true
  };
}

/**
 * @param {{offer:'onepage'|'landing-pages'|'performance',channels?:Record<string,number>}} selection
 * @returns {Readonly<object>} Valor ilustrativo e NÃO uma fatura.
 */
export function previewCommercialSelection(selection) {
  if (!plainObject(selection) || !hasOnlyKeys(selection,['offer','channels']) ||
      typeof selection.offer !== 'string') fail('Invalid selection');
  if (Object.hasOwn(PREVIEW_SITES,selection.offer)) {
    if (Object.hasOwn(selection,'channels')) fail('Websites cannot specify media channels');
    const info=PREVIEW_SITES[selection.offer];
    return frozen({
      ...common(selection.offer),setupCents:info.setupCents,
      installmentCount:info.installments,installmentCents:info.installmentCents,
      monthlyCents:info.monthlyCents,firstMonthlyAfterDays:info.firstMonthlyAfterDays,
      firstMonthlyRelativeTo:'contract_date_not_publication',
      mediaPaidToPlatformsCents:0,estimatedMonthlyManagementCents:0,
      channels:frozen([])
    });
  }
  if (selection.offer!=='performance' || !plainObject(selection.channels) ||
      !hasOnlyKeys(selection.channels,Object.keys(PREVIEW_CHANNELS))) {
    fail('Offer or channel not available for reviewed preview');
  }
  const names=Object.keys(selection.channels);
  if (names.length===0) fail('At least one reviewed channel is required');
  const channels=names.sort().map(code=>{
    const policy=PREVIEW_CHANNELS[code];
    const plannedMediaCents=amount(selection.channels[code],'planned media');
    if (plannedMediaCents<policy.minimumMediaCents) fail('Media under approved minimum: '+code);
    return frozen({
      code,plannedMediaCents,minimumMediaCents:policy.minimumMediaCents,
      recommendedMediaCents:policy.recommendedMediaCents,
      activationCents:policy.activationCents,
      estimatedMonthlyManagementCents:illustrateFullMonthManagementCents(plannedMediaCents)
    });
  });
  const sum=key=>channels.reduce((total,channel)=>total+channel[key],0);
  return frozen({
    ...common('performance'),channels:frozen(channels),
    activationCents:sum('activationCents'),
    plannedMediaPaidToPlatformsCents:sum('plannedMediaCents'),
    estimatedMonthlyManagementCents:sum('estimatedMonthlyManagementCents'),
    minimumMonthlyManagementPerChannelCents:MONTHLY_MANAGEMENT_MINIMUM_PER_CHANNEL_CENTS,
    managementPercentage:MONTHLY_MANAGEMENT_RATE_PERCENT,managementSettledOn:'verified_actual_media_full_civil_month',
    estimateNotInvoice:true,
    mediaPaidDirectlyToPlatforms:true
  });
}

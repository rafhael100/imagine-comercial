/**
 * F355: per-channel, nonbinding breakdown of the anonymous public estimate.
 * Values come only from the reviewed, integer-cent estimate policy.
 * No URL, customer, event, live price, checkout or external request.
 */
import {buildCommercialChoicePreview} from './commercial-choice-preview.mjs';

const LABELS=Object.freeze({
 'pt-BR':Object.freeze({google_ads:'Google Ads',meta_ads:'Meta Ads',chatgpt_ads:'ChatGPT Ads'}),
 en:Object.freeze({google_ads:'Google Ads',meta_ads:'Meta Ads',chatgpt_ads:'ChatGPT Ads'}),
 es:Object.freeze({google_ads:'Google Ads',meta_ads:'Meta Ads',chatgpt_ads:'ChatGPT Ads'})
});

export function describeSelectedAdvertisingCosts(selection,locale='pt-BR'){
 if(typeof locale!=='string'||!Object.hasOwn(LABELS,locale))
  throw new TypeError('Unsupported advertising cost locale');
 const estimate=buildCommercialChoicePreview(selection);
 return Object.freeze(estimate.adLines.map(line=>Object.freeze({
  code:line.channel,
  label:LABELS[locale][line.channel],
  activationCents:line.activationCents,
  mediaCents:line.mediaCents,
  estimatedManagementCents:line.managementCents
 })));
}

/**
 * F324: exact approved quote-intent messages (no PII, free text or monetary
 * claims). Only the visitor's finite product/channel/media-tier choices enter
 * the opt-in WhatsApp message. This is not a contractual offer.
 */
import {buildCommercialChoicePreview} from '../lib/commercial-choice-preview.mjs';
export const QUOTE_LOCALES=Object.freeze(['pt-BR','en','es']);
const sites=Object.freeze(['none','onepage','landing-pages']);
const channels=Object.freeze([[],['google_ads'],['meta_ads'],['google_ads','meta_ads']]);
const tiers=Object.freeze(['minimum','recommended']);
const labels=Object.freeze({
 'pt-BR':Object.freeze({
  sites:Object.freeze({none:'',onepage:'Onepage','landing-pages':'Landing Page'}),
  channels:Object.freeze({google_ads:'Google Ads',meta_ads:'Meta Ads'}),
  tier:Object.freeze({minimum:'mídia no patamar mínimo',recommended:'mídia no patamar recomendado'})
 }),
 en:Object.freeze({
  sites:Object.freeze({none:'',onepage:'Onepage','landing-pages':'Landing Page'}),
  channels:Object.freeze({google_ads:'Google Ads',meta_ads:'Meta Ads'}),
  tier:Object.freeze({minimum:'minimum media plan',recommended:'recommended media plan'})
 }),
 es:Object.freeze({
  sites:Object.freeze({none:'',onepage:'Onepage','landing-pages':'Landing Page'}),
  channels:Object.freeze({google_ads:'Google Ads',meta_ads:'Meta Ads'}),
  tier:Object.freeze({minimum:'inversión mínima en publicidad',recommended:'inversión recomendada en publicidad'})
 })
});
const key=({site,channels:chosen,tier})=>
  site+'|'+[...chosen].sort().join(',')+'|'+tier;
function generate(locale,selection){
 const names=labels[locale];
 const items=[names.sites[selection.site],...selection.channels.map(c=>names.channels[c])].filter(Boolean);
 const choice=items.join(' + ');
 const suffix=names.tier[selection.tier];
 if(locale==='en')
  return 'Hello Imagine! I would like to discuss this website/ads estimate: '+choice+'; '+suffix+'. I understand final terms must be confirmed.';
 if(locale==='es')
  return 'Hola Imagine, quisiera consultar esta estimación de sitio y anuncios: '+choice+'; '+suffix+'. Entiendo que los valores definitivos deben confirmarse.';
 return 'Olá, Imagine! Gostaria de conversar sobre esta simulação de site e anúncios: '+choice+'; '+suffix+'. Sei que os valores finais precisam ser confirmados.';
}
export const REVIEWED_QUOTE_MESSAGES=Object.freeze(Object.fromEntries(QUOTE_LOCALES.map(locale=>[
 locale,Object.freeze(Object.fromEntries(sites.flatMap(site=>channels.flatMap(chosen=>tiers.map(tier=>{
  const selection={site,channels:chosen,tier};
  const quote=buildCommercialChoicePreview(selection);
  return quote.hasChoice?[key(selection),generate(locale,selection)]:null;
 }).filter(Boolean))))
])));
for(const locale of QUOTE_LOCALES){
 const messages=Object.values(REVIEWED_QUOTE_MESSAGES[locale]);
 if(messages.length!==22||new Set(messages).size!==22||
   messages.some(message=>message.length>280||/[\r\n\x00-\x1f]/.test(message)))
   throw Error('F324: invalid reviewed quote message catalog');
}
export function reviewedQuoteChoiceMessage(locale,selection){
 if(typeof locale!=='string'||!Object.hasOwn(REVIEWED_QUOTE_MESSAGES,locale))
  throw new TypeError('Unreviewed quote locale');
 const quote=buildCommercialChoicePreview(selection);
 if(!quote.hasChoice)throw new TypeError('Empty estimate has no contact action');
 const reviewed=REVIEWED_QUOTE_MESSAGES[locale][key(quote)];
 if(typeof reviewed!=='string')throw new TypeError('Unreviewed quote combination');
 return reviewed;
}

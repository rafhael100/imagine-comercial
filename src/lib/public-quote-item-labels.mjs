/** F354: curated anonymous service labels, not a cart, identity or checkout. */
import {buildCommercialChoicePreview} from './commercial-choice-preview.mjs';
const DICTIONARY=Object.freeze({
 'pt-BR':Object.freeze({site:Object.freeze({onepage:'Site · Onepage','landing-pages':'Site · Landing Page'}),ads:Object.freeze({google_ads:'Anúncios · Google Ads',meta_ads:'Anúncios · Meta Ads',chatgpt_ads:'Anúncios · ChatGPT Ads'})}),
 en:Object.freeze({site:Object.freeze({onepage:'Website · Onepage','landing-pages':'Website · Landing Page'}),ads:Object.freeze({google_ads:'Advertising · Google Ads',meta_ads:'Advertising · Meta Ads',chatgpt_ads:'Advertising · ChatGPT Ads'})}),
 es:Object.freeze({site:Object.freeze({onepage:'Sitio web · Onepage','landing-pages':'Sitio web · Landing Page'}),ads:Object.freeze({google_ads:'Anuncios · Google Ads',meta_ads:'Anuncios · Meta Ads',chatgpt_ads:'Anuncios · ChatGPT Ads'})})
});
export function describeSelectedQuoteServices(selection,locale='pt-BR'){
 if(typeof locale!=='string'||!Object.hasOwn(DICTIONARY,locale))
  throw new TypeError('Unsupported quote summary locale');
 const quote=buildCommercialChoicePreview(selection),t=DICTIONARY[locale],items=[];
 if(quote.site!=='none')items.push(Object.freeze({kind:'site',code:quote.site,label:t.site[quote.site]}));
 for(const code of quote.channels)items.push(Object.freeze({kind:'advertising',code,label:t.ads[code]}));
 return Object.freeze(items);
}

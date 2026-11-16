/**
 * F346 — voluntary, local-only copy of a reviewed commercial estimate.
 * Only finite site/channel/tier choices (already accepted by F341) enter
 * this text. Not an order, contract, CRM lead, checkout, URL or invoice.
 */
import {
 buildCommercialChoicePreview,describeThreeIllustrativeInstallments
} from './commercial-choice-preview.mjs';

const labels=Object.freeze({
 'pt-BR':Object.freeze({
  title:'Simulação Imagine — não é proposta nem contratação',
  services:'Serviços escolhidos',emptySite:'Sem site',
  site:Object.freeze({onepage:'Site Onepage','landing-pages':'Landing Page'}),
  channels:Object.freeze({google_ads:'Google Ads',meta_ads:'Meta Ads',chatgpt_ads:'ChatGPT Ads'}),
  tier:'Investimento em mídia',tiers:Object.freeze({minimum:'Mínimo',recommended:'Recomendado'}),
  setup:'Implantação do site',activation:'Ativação dos anúncios (uma vez)',
  parts:'Implantação + ativações em 3 parcelas sem juros',
  total:'total ilustrativo',
  monthly:'Mensalidade do site',day90:'início a partir de 90 dias da contratação',
  management:'Gestão de anúncios estimada por mês',
  postpaid:'apurada após o mês civil completo, sobre mídia efetiva',
  media:'Mídia planejada por mês',direct:'paga diretamente às plataformas',
  notice:'Valores meramente ilustrativos, sem cadastro ou pagamento. Termos finais dependem de confirmação no Portal.'
 }),
 en:Object.freeze({
  title:'Imagine estimate — not an offer or purchase',
  services:'Selected services',emptySite:'No website',
  site:Object.freeze({onepage:'Onepage website','landing-pages':'Landing Page'}),
  channels:Object.freeze({google_ads:'Google Ads',meta_ads:'Meta Ads',chatgpt_ads:'ChatGPT Ads'}),
  tier:'Media planning',tiers:Object.freeze({minimum:'Minimum',recommended:'Recommended'}),
  setup:'Website setup',activation:'Ads activation (one-time)',
  parts:'Setup + activations in 3 interest-free installments',
  total:'illustrative total',
  monthly:'Website monthly fee',day90:'starts 90 days after contracting',
  management:'Estimated ads management per month',
  postpaid:'calculated after a full calendar month, based on actual spend',
  media:'Planned media spend per month',direct:'paid directly to platforms',
  notice:'Illustrative values only; no signup or payment. Final terms require confirmation in the Portal.'
 }),
 es:Object.freeze({
  title:'Estimación Imagine — no es una oferta ni una compra',
  services:'Servicios elegidos',emptySite:'Sin sitio web',
  site:Object.freeze({onepage:'Sitio Onepage','landing-pages':'Landing Page'}),
  channels:Object.freeze({google_ads:'Google Ads',meta_ads:'Meta Ads',chatgpt_ads:'ChatGPT Ads'}),
  tier:'Plan de publicidad',tiers:Object.freeze({minimum:'Mínimo',recommended:'Recomendado'}),
  setup:'Implantación del sitio',activation:'Activación de anuncios (única)',
  parts:'Implantación + activaciones en 3 cuotas sin intereses',
  total:'total ilustrativo',
  monthly:'Mensualidad del sitio',day90:'comienza 90 días después de contratar',
  management:'Gestión de anuncios estimada por mes',
  postpaid:'calculada tras el mes civil completo según inversión real',
  media:'Inversión prevista en medios por mes',direct:'pagada directamente a las plataformas',
  notice:'Valores solo ilustrativos, sin registro ni pago. Condiciones finales sujetas a confirmación en el Portal.'
 })
});

/**
 * Nothing here can copy itself, navigate, send data or access the network.
 * The browser invokes this only from an explicit visitor click.
 */
export function formatReviewedCommercialEstimate(selection,locale='pt-BR'){
 if(typeof locale!=='string'||!Object.hasOwn(labels,locale))
  throw new TypeError('Unreviewed commercial estimate locale');
 const quote=buildCommercialChoicePreview(selection);
 if(!quote.hasChoice)throw new TypeError('No anonymous selection to copy');
 const t=labels[locale];
 const money=cents=>(locale==='en'?'BRL ':'R$ ')+
  (cents/100).toLocaleString(locale==='en'?'en-US':'pt-BR',{
   minimumFractionDigits:2,maximumFractionDigits:2
  });
 const product=[
  quote.site==='none'?t.emptySite:t.site[quote.site],
  ...quote.channels.map(code=>t.channels[code])
 ].join(' + ');
 const lines=[
  t.title,
  t.services+': '+product,
  t.tier+': '+t.tiers[quote.tier],
  t.setup+': '+money(quote.siteSetupCents),
  t.activation+': '+money(quote.adActivationCents),
  t.parts+': '+describeThreeIllustrativeInstallments(
   quote.contractedSetupAndActivationCents,locale)+' ('+
   t.total+': '+money(quote.contractedSetupAndActivationCents)+')',
  t.monthly+': '+money(quote.siteMonthlyCents)+' ('+t.day90+')',
  t.management+': '+money(quote.adManagementEstimateCents)+
   ' ('+t.postpaid+')',
  t.media+': '+money(quote.adMediaCents)+' ('+t.direct+')',
  t.notice
 ];
 const output=lines.join('\n');
 if(output.length>2000)throw Error('Commercial estimate text is too long');
 return output;
}

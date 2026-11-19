/**
 * F348 — user-visible scope of the anonymous selection in the *current
 * pinned Portal V5 preview*, not authorization to take an order.
 *
 * No private Portal URL, price, customer, token, form or network operation.
 * Real checkout ALWAYS remains disabled, including for a single approved SKU.
 */
import {buildCommercialChoicePreview} from './commercial-choice-preview.mjs';

export const REVIEWED_PORTAL_READINESS_CODES=Object.freeze([
 'no_selection',
 'private_single_preview_only',
 'multi_product_cart_required',
 'multi_channel_cart_required',
 'chatgpt_ads_not_in_portal_catalog'
]);
const messages=Object.freeze({
 'pt-BR':Object.freeze({
  no_selection:'Escolha ao menos um serviço para consultar o escopo do orçamento.',
  private_single_preview_only:'Um serviço compatível apenas com a prévia privada do Portal. A contratação pública ainda não está disponível; valores finais exigem nova validação.',
  multi_product_cart_required:'Site e anúncios juntos ainda exigem um carrinho integrado e novo cálculo no Portal. Esta é somente uma estimativa; você pode conversar com a equipe.',
  multi_channel_cart_required:'A contratação conjunta de vários canais ainda exige um carrinho integrado no Portal. Esta estimativa não é uma compra.',
  chatgpt_ads_not_in_portal_catalog:'ChatGPT Ads ainda não está aprovado no catálogo de contratação do Portal. Valores exibidos são somente para planejamento; não há checkout.'
 }),
 en:Object.freeze({
  no_selection:'Select at least one service to review estimate availability.',
  private_single_preview_only:'One service is compatible only with the private Portal preview. Public checkout is not available; final terms require server review.',
  multi_product_cart_required:'Website plus advertising requires a combined cart and fresh server pricing in the Portal. This is an estimate only; you can contact the team.',
  multi_channel_cart_required:'Several advertising channels require a combined cart in the Portal. This estimate is not a purchase.',
  chatgpt_ads_not_in_portal_catalog:'ChatGPT Ads is not yet approved in the Portal checkout catalog. These amounts are planning illustrations only, with no checkout.'
 }),
 es:Object.freeze({
  no_selection:'Elige al menos un servicio para consultar el alcance del presupuesto.',
  private_single_preview_only:'Un servicio solo es compatible con la vista previa privada del Portal. No existe checkout público; las condiciones requieren revisión del servidor.',
  multi_product_cart_required:'Sitio y anuncios juntos requieren un carrito integrado y nuevos cálculos en el Portal. Esto es solo una estimación; puedes hablar con el equipo.',
  multi_channel_cart_required:'Varios canales de anuncios requieren un carrito integrado en el Portal. Esta estimación no es una compra.',
  chatgpt_ads_not_in_portal_catalog:'ChatGPT Ads todavía no está aprobado en el catálogo de contratación del Portal. Son valores de planificación, sin checkout.'
 })
});

/** Reviewed public explanation only, never an operational permission. */
export function assessPublicPortalReadiness(selection){
 const estimate=buildCommercialChoicePreview(selection);
 let code;
 if(!estimate.hasChoice)code='no_selection';
 else if(estimate.channels.includes('chatgpt_ads'))
  code='chatgpt_ads_not_in_portal_catalog';
 else if(estimate.site!=='none'&&estimate.channels.length>0)
  code='multi_product_cart_required';
 else if(estimate.channels.length>1)
  code='multi_channel_cart_required';
 else code='private_single_preview_only';
 return Object.freeze({
  code,
  privateSinglePreviewEligible:code==='private_single_preview_only',
  publicCheckoutAuthorized:false,
  automaticChargeAuthorized:false,
  portalLoginOrRedirectAuthorized:false,
  finalServerRepricingRequired:true
 });
}
export function describePublicPortalReadiness(selection,locale='pt-BR'){
 if(typeof locale!=='string'||!Object.hasOwn(messages,locale))
  throw new TypeError('Unsupported public Portal readiness locale');
 return messages[locale][assessPublicPortalReadiness(selection).code];
}

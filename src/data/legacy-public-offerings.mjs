/**
 * F172 — offline inventory of public category HEADINGS observed on the
 * legacy Imagine website. Headings are NOT proof of current service scope,
 * price, entitlement, contract or approved redirect. Candidate means human
 * comparison is REQUIRED, never automatic equivalence.
 *
 * Public references (reviewed 2026-11-11; not fetched by app/CI):
 * https://www.imaginecomunicacao.com.br/
 * https://www.imaginecomunicacao.com.br/clientes.html
 */
import {services} from './services.mjs';

const raw=Object.freeze([
  ['Criação de Sites Personalizados','criacao-de-sites'],
  ['Landing Pages','landing-pages'],
  ['Sistemas Personalizados',null],
  ['Criação de Aplicativos Apple e Android',null],
  ['Criação de Loja Virtual',null],
  ['Google Ads - Anúncios','gestao-google-ads'],
  ['Redes Sociais - Gerenciamento',null],
  ['Facebook Business',null],
  ['Instagram Business',null],
  ['Anúncios no Youtube',null],
  ['Linkedin Business',null],
  ['Amazon - Marketplace',null],
  ['Mercado Livre - Marketplace',null],
  ['Facebook/Instagram Ads','gestao-meta-ads']
]);
const liveSlugs=new Set(services.map(s=>s.slug));
if(services.length!==6||raw.length!==14||
  new Set(raw.map(x=>x[0])).size!==raw.length||
  raw.some(([label,slug])=>typeof label!=='string'||label.length<5||
    (slug!==null&&!liveSlugs.has(slug)))||
  new Set(raw.map(x=>x[1]).filter(Boolean)).size!==4)
  throw Error('F172: public service inventory needs editorial re-review');

export const legacyPublicOfferingHeadings=Object.freeze(raw.map(([label,possibleSlug])=>
  Object.freeze({
    label,possibleSlug,
    status:possibleSlug===null?'HOLD_UNMAPPED':'CANDIDATE_REVIEW_NOT_EQUIVALENT'
  })
));
export function reviewLegacyPublicOfferings(){
  const candidates=legacyPublicOfferingHeadings.filter(x=>x.possibleSlug!==null);
  const held=legacyPublicOfferingHeadings.filter(x=>x.possibleSlug===null);
  const newlyIntroduced=services.map(s=>s.slug).filter(slug=>
    !candidates.some(item=>item.possibleSlug===slug));
  return Object.freeze({
    schema:'imagine.comercial.legacy-public-offerings.v1',
    status:'HOLD_PUBLIC_SERVICE_SCOPE_NOT_OWNER_VERIFIED',
    evidenceClass:'OFFLINE_EDITORIAL_SNAPSHOT_NOT_A_SERVICE_CONTRACT',
    legacyHeadingsObserved:legacyPublicOfferingHeadings.length,
    candidatesRequiringManualEquivalence:candidates.length,
    unmappedLegacyHeadings:held.length,
    newCatalogSlugsRequiringScopeReview:newlyIntroduced.length,
    candidateSlugs:Object.freeze(candidates.map(x=>x.possibleSlug)),
    heldHeadings:Object.freeze(held.map(x=>x.label)),
    newOnlySlugs:Object.freeze(newlyIntroduced),
    oldOfferingsStillSoldVerified:false,
    contentScopeOwnerApproved:false,
    legacyToNewEquivalenceVerified:false,
    pricingAndContractTermsVerified:false,
    seoRedirectsAuthorized:false,
    productionCatalogReplacementAuthorized:false,
    deploymentAuthorized:false
  });
}

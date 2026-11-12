/**
 * F250 — reviewed categories for discovering existing commercial services.
 * A presentation-only classification: NOT an offer, pricing, eligibility,
 * recommendation, publication override or approval to capture leads.
 */
import {services} from './services.mjs';

const fixedGroups=[
  {code:'all',label:'Todos os serviços'},
  {code:'sites',label:'Sites e páginas'},
  {code:'assinaturas',label:'Assinatura'},
  {code:'anuncios',label:'Anúncios'}
];

export const serviceCatalogGroups=Object.freeze(
  fixedGroups.map(group=>Object.freeze({...group}))
);

const categories=Object.freeze({
  'criacao-de-sites':'sites',
  'landing-pages':'sites',
  'onepage':'sites',
  'sites-por-assinatura':'assinaturas',
  'gestao-google-ads':'anuncios',
  'gestao-meta-ads':'anuncios'
});
const allowed=new Set(serviceCatalogGroups.filter(x=>x.code!=='all').map(x=>x.code));
const listed=new Set(services.map(s=>s.slug));
if(services.length!==Object.keys(categories).length ||
   new Set(services.map(s=>s.slug)).size!==services.length ||
   Object.keys(categories).some(slug=>!listed.has(slug))||
   services.some(s=>!Object.hasOwn(categories,s.slug))||
   Object.values(categories).some(code=>!allowed.has(code)))
  throw Error('F250: service catalog groups do not cover the reviewed catalog');

/** Unknown service slugs do not get a guessed category. */
export function categoryForService(slug){
  return typeof slug==='string'&&Object.hasOwn(categories,slug)
    ? categories[slug]:null;
}

/**
 * F195: curated, static alternatives to compare on each published service page.
 * These are editorial navigation suggestions, never eligibility, pricing,
 * customer profiling, automatic recommendations or a commercial proposal.
 */
import {services} from './services.mjs';
import {comparisonOptions} from './service-comparison.mjs';
import {encodeReviewedComparisonFragment} from './reviewed-comparison-fragment.mjs';
const alternativeSlugs=Object.freeze({
  'onepage':Object.freeze(['criacao-de-sites','landing-pages']),
  'criacao-de-sites':Object.freeze(['onepage','sites-por-assinatura']),
  'landing-pages':Object.freeze(['onepage','criacao-de-sites']),
  'sites-por-assinatura':Object.freeze(['onepage','criacao-de-sites']),
  'gestao-google-ads':Object.freeze(['gestao-meta-ads','landing-pages']),
  'gestao-meta-ads':Object.freeze(['gestao-google-ads','landing-pages'])
});
const bySlug=new Map(comparisonOptions.map(item=>[item.slug,item]));
if(Object.keys(alternativeSlugs).length!==services.length||
  services.some(item=>!Object.hasOwn(alternativeSlugs,item.slug))||
  Object.entries(alternativeSlugs).some(([slug,items])=>
    items.length!==2||new Set(items).size!==2||
    items.some(other=>other===slug||!bySlug.has(other))))
  throw Error('F195: invalid editorial comparison map');

export function curatedServiceComparisons(slug){
  if(typeof slug!=='string'||!Object.hasOwn(alternativeSlugs,slug))
    throw Error('F195: unreviewed service');
  return Object.freeze(alternativeSlugs[slug].map(other=>Object.freeze({
    slug:other,label:bySlug.get(other).label,
    href:'/comparar-solucoes/'+encodeReviewedComparisonFragment([slug,other])
  })));
}

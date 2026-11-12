/**
 * F200: closed editorial connections from two existing comparison guides
 * to the exact public pair of services they discuss. No automatic scoring,
 * profiling, quote, pricing, visitor text or new indexable pages.
 */
import {articles} from './articles.mjs';
import {comparisonOptions} from './service-comparison.mjs';
import {encodeReviewedComparisonFragment} from './reviewed-comparison-fragment.mjs';
const reviewedPairs=Object.freeze({
  'landing-page-ou-site':Object.freeze(['criacao-de-sites','landing-pages']),
  'google-ads-ou-meta-ads':Object.freeze(['gestao-google-ads','gestao-meta-ads'])
});
const knownArticles=new Set(articles.map(article=>article.slug));
const knownServices=new Set(comparisonOptions.map(item=>item.slug));
if(Object.keys(reviewedPairs).length!==2||
  Object.entries(reviewedPairs).some(([slug,pair])=>!knownArticles.has(slug)||
    pair.length!==2||pair[0]===pair[1]||pair.some(item=>!knownServices.has(item))))
  throw Error('F200: invalid reviewed article comparisons');

export function comparisonForArticle(slug){
  if(typeof slug!=='string'||!knownArticles.has(slug))
    throw Error('F200: unknown public article slug');
  const pair=reviewedPairs[slug];
  return pair?Object.freeze({
    href:'/comparar-solucoes/'+encodeReviewedComparisonFragment(pair),
    label:'Comparar as duas soluções lado a lado'
  }):null;
}

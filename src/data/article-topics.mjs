/**
 * F152 — curated topic navigation for public educational articles.
 * Pure, deterministic, no user input storage, analytics or remote calls.
 */
import {articles} from './articles.mjs';

export const guideTopics=Object.freeze([
  Object.freeze({code:'all',label:'Todos os guias'}),
  Object.freeze({code:'sites',label:'Sites'}),
  Object.freeze({code:'landing-pages',label:'Landing Pages'}),
  Object.freeze({code:'seo',label:'SEO'}),
  Object.freeze({code:'anuncios',label:'Anúncios'}),
  Object.freeze({code:'contratacao',label:'Contratação'})
]);

const bySlug=Object.freeze({
  'landing-page-ou-site':Object.freeze(['sites','landing-pages','contratacao']),
  'quanto-custa-uma-landing-page':Object.freeze(['landing-pages','contratacao']),
  'google-ads-ou-meta-ads':Object.freeze(['anuncios']),
  'seo-para-sites-empresariais':Object.freeze(['sites','seo']),
  'criacao-de-sites-fortaleza-guia':Object.freeze(['sites','seo','contratacao'])
});

const validTopics=new Set(guideTopics.map(x=>x.code).filter(x=>x!=='all'));
const slugs=new Set(articles.map(x=>x.slug));
if(slugs.size!==articles.length||slugs.size!==Object.keys(bySlug).length||
  [...slugs].some(slug=>!Object.hasOwn(bySlug,slug))||
  Object.entries(bySlug).some(([,topics])=>
    topics.length===0||topics.some(topic=>!validTopics.has(topic))||
    new Set(topics).size!==topics.length))
  throw Error('F152: editorial filter is not synchronized with reviewed articles');

export function topicsForGuide(slug){
  return typeof slug==='string'&&Object.hasOwn(bySlug,slug)
    ?bySlug[slug]:Object.freeze([]);
}

export function guidesForTopic(topic){
  if(typeof topic!=='string'||!guideTopics.some(x=>x.code===topic))
    return Object.freeze([]);
  return Object.freeze(articles.filter(x=>
    topic==='all'||topicsForGuide(x.slug).includes(topic)));
}

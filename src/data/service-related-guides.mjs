/**
 * F142 — small, curated connections between service pages and genuinely
 * related editorial guides. No automated location permutations or
 * customer-generated outbound URLs.
 */
import {articles} from './articles.mjs';
import {services} from './services.mjs';

const guideSlugsByService=Object.freeze({
  'criacao-de-sites':[
    'criacao-de-sites-fortaleza-guia',
    'seo-para-sites-empresariais',
    'landing-page-ou-site'
  ],
  'landing-pages':['quanto-custa-uma-landing-page','landing-page-ou-site'],
  'onepage':['landing-page-ou-site'],
  'sites-por-assinatura':['landing-page-ou-site'],
  'gestao-google-ads':['google-ads-ou-meta-ads'],
  'gestao-meta-ads':['google-ads-ou-meta-ads']
});
const articleBySlug=new Map(articles.map(article=>[article.slug,article]));
const serviceSlugs=new Set(services.map(service=>service.slug));
for(const [service,slugs] of Object.entries(guideSlugsByService)){
  if(!serviceSlugs.has(service)||!Array.isArray(slugs)||
    slugs.length<1||slugs.length>3||
    new Set(slugs).size!==slugs.length||
    slugs.some(slug=>!articleBySlug.has(slug)))
    throw Error('F142: invalid curated service/guide mapping');
}

export function relatedEditorialGuides(serviceSlug){
  if(typeof serviceSlug!=='string'||!serviceSlugs.has(serviceSlug))
    return Object.freeze([]);
  return Object.freeze((guideSlugsByService[serviceSlug]??[]).map(slug=>{
    const a=articleBySlug.get(slug);
    return Object.freeze({
      title:a.heading,
      label:a.eyebrow,
      href:'/conteudos/'+a.slug+'/'
    });
  }));
}

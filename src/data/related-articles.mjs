/**
 * F154 — editorially curated "Leia também" navigation for every article.
 * All slugs are published, static catalog entries; no recommendation
 * tracking, personalization, remote search or invented destination.
 */
import {articles} from './articles.mjs';

const bySlug=Object.freeze({
  'landing-page-ou-site':Object.freeze([
    'quanto-custa-uma-landing-page','seo-para-sites-empresariais'
  ]),
  'quanto-custa-uma-landing-page':Object.freeze([
    'landing-page-ou-site','criacao-de-sites-fortaleza-guia'
  ]),
  'google-ads-ou-meta-ads':Object.freeze([
    'landing-page-ou-site','seo-para-sites-empresariais'
  ]),
  'seo-para-sites-empresariais':Object.freeze([
    'landing-page-ou-site','criacao-de-sites-fortaleza-guia'
  ]),
  'criacao-de-sites-fortaleza-guia':Object.freeze([
    'seo-para-sites-empresariais','landing-page-ou-site'
  ])
});

const articleBySlug=new Map(articles.map(x=>[x.slug,x]));
if(articleBySlug.size!==articles.length||
  Object.keys(bySlug).length!==articleBySlug.size||
  [...articleBySlug.keys()].some(slug=>!Object.hasOwn(bySlug,slug))||
  Object.entries(bySlug).some(([slug,related])=>
    related.length!==2||new Set(related).size!==related.length||
    related.some(next=>next===slug||!articleBySlug.has(next))))
  throw Error('F154: curated article relationships do not match published catalog');

export function relatedGuidesFor(slug){
  if(typeof slug!=='string'||!Object.hasOwn(bySlug,slug))
    return Object.freeze([]);
  return Object.freeze(bySlug[slug].map(next=>{
    const article=articleBySlug.get(next);
    return Object.freeze({
      href:'/conteudos/'+article.slug+'/',
      title:article.heading,
      topic:article.eyebrow
    });
  }));
}

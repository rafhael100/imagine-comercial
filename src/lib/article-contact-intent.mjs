/**
 * F145 — contexto do CTA de artigos, usando somente links já curados
 * para serviços publicados. Não lê query/identidade do visitante.
 */
import {articles} from '../data/articles.mjs';
import {services} from '../data/services.mjs';

const serviceByPath=new Map(services.map(item=>[
  '/servicos/'+item.slug+'/',item
]));

export function articleContactIntent(article){
  if(!articles.includes(article))
    throw new Error('F145: article outside reviewed catalog');
  const related=article.links.find(link=>serviceByPath.has(link.href));
  if(!related)return Object.freeze({
    href:'/contato/',label:'Conversar sobre meu projeto',serviceSlug:''
  });
  const service=serviceByPath.get(related.href);
  return Object.freeze({
    href:'/contato/#'+service.slug,
    label:'Conversar sobre '+service.label,
    serviceSlug:service.slug
  });
}

/** F190: fixed service-to-FAQ references; no visitor profile or tracking. */
import {services} from './services.mjs';
import {commercialFaqSections} from './commercial-faq.mjs';

const questionMap=new Map(commercialFaqSections.flatMap(section=>
  section.questions.map(item=>[item.id,item.question])
));
const mapped=Object.freeze({
  'criacao-de-sites':Object.freeze(['escolha','revisoes']),
  'landing-pages':Object.freeze(['escolha','resultados']),
  'onepage':Object.freeze(['escolha','materiais']),
  'sites-por-assinatura':Object.freeze(['precos','portal']),
  'gestao-google-ads':Object.freeze(['midia','resultados']),
  'gestao-meta-ads':Object.freeze(['midia','resultados'])
});
if(Object.keys(mapped).length!==services.length||
   services.some(service=>!Object.hasOwn(mapped,service.slug))||
   Object.values(mapped).some(ids=>ids.length!==2||
     new Set(ids).size!==2||ids.some(id=>!questionMap.has(id))))
  throw Error('F190: invalid curated service FAQ references');

export function serviceFaqLinks(slug){
  if(typeof slug!=='string'||!Object.hasOwn(mapped,slug))
    throw Error('F190: unknown service slug');
  return Object.freeze(mapped[slug].map(id=>Object.freeze({
    href:'/perguntas-frequentes/#duvida-'+id,
    label:questionMap.get(id)
  })));
}

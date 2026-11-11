/**
 * F60 — public editorial comparison. No prices, inferred entitlement,
 * eligibility score, customer profile, tracking or contractual offer.
 * The six slugs must match the existing catalog exactly.
 */
import {services} from './services.mjs';

const curated=Object.freeze([
  {
    slug:'onepage',group:'presenca',bestFor:'Apresentação objetiva de um negócio',
    structure:'Informações essenciais em uma página organizada por seções.',
    question:'A empresa consegue apresentar os principais serviços e contatos sem precisar de várias páginas?'
  },
  {
    slug:'criacao-de-sites',group:'presenca',bestFor:'Vários serviços, assuntos e conteúdos',
    structure:'Páginas específicas para temas, soluções e informações institucionais.',
    question:'A diversidade de serviços exige caminhos e conteúdos independentes?'
  },
  {
    slug:'landing-pages',group:'presenca',bestFor:'Campanha ou oferta com ação específica',
    structure:'Mensagem concentrada em uma oferta e uma ação principal.',
    question:'O visitante chega com um objetivo ou campanha claramente definido?'
  },
  {
    slug:'sites-por-assinatura',group:'presenca',bestFor:'Avaliar um modelo de acompanhamento recorrente',
    structure:'Formato, entregas e continuidade definidos em proposta e contrato.',
    question:'O negócio precisa comparar as condições de implantação e manutenção recorrente?'
  },
  {
    slug:'gestao-google-ads',group:'midia',bestFor:'Pessoas buscando ativamente soluções',
    structure:'Planejamento de campanhas associado ao contexto de pesquisa.',
    question:'Existe demanda de busca relevante para os serviços anunciados?'
  },
  {
    slug:'gestao-meta-ads',group:'midia',bestFor:'Apresentar ofertas e criar oportunidades de descoberta',
    structure:'Planejamento de campanhas para Instagram e Facebook, com atenção a criativos e público.',
    question:'Como comunicar a oferta a pessoas que ainda não estão pesquisando por ela?'
  }
]);

const catalog=new Map(services.map(service=>[service.slug,service]));
if(new Set(curated.map(x=>x.slug)).size!==curated.length ||
  curated.length!==services.length ||
  curated.some(x=>!catalog.has(x.slug)||!['presenca','midia'].includes(x.group)))
  throw new Error('F60: comparison must exactly cover reviewed services');

export const comparisonGroups=Object.freeze([
  Object.freeze({code:'presenca',heading:'Formatos de presença digital',
    introduction:'A estrutura ideal depende da quantidade de assuntos, da oferta e do tipo de acompanhamento necessário.'}),
  Object.freeze({code:'midia',heading:'Gestão de mídia digital',
    introduction:'Os canais trabalham com contextos de descoberta diferentes. O investimento em mídia e a gestão devem ser avaliados separadamente na proposta.'})
]);
export const comparisonOptions=Object.freeze(curated.map(x=>
  Object.freeze({
    ...x,label:catalog.get(x.slug).label,
    detailHref:'/servicos/'+x.slug+'/',
    contactHref:'/contato/#'+x.slug
  })
));

export function compareOptionsForGroup(code){
  if(typeof code!=='string'||!comparisonGroups.some(g=>g.code===code))
    throw new Error('F60: invalid public comparison group');
  return comparisonOptions.filter(x=>x.group===code);
}

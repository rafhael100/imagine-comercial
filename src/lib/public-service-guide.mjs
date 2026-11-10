/**
 * F58 — public guidance only, NOT an eligibility, price or purchase engine.
 * The whitelist is curated from existing published service slugs. No client
 * data, network transport, profile, persistence, quote or commercial promise.
 */
import {services} from '../data/services.mjs';

const bySlug=new Map(services.map(service=>[service.slug,service]));
const guide=[
  {
    code:'apresentar',
    goal:'Apresentar uma empresa de forma objetiva',
    explanation:'Se a apresentação e os contatos cabem em uma página organizada, a Onepage pode ser um ponto de partida.',
    slugs:['onepage']
  },
  {
    code:'detalhar',
    goal:'Explicar vários serviços e conteúdos',
    explanation:'Quando há diversos assuntos que merecem páginas próprias, um site com navegação por temas pode ser mais adequado.',
    slugs:['criacao-de-sites']
  },
  {
    code:'oferta',
    goal:'Divulgar uma oferta ou campanha específica',
    explanation:'Uma Landing Page concentra a mensagem em uma oferta e na ação esperada do visitante.',
    slugs:['landing-pages']
  },
  {
    code:'continuidade',
    goal:'Avaliar contratação com acompanhamento recorrente',
    explanation:'Sites por assinatura podem atender a quem procura um modelo de continuidade; escopo, preço e condições dependem da proposta oficial.',
    slugs:['sites-por-assinatura']
  },
  {
    code:'anuncios',
    goal:'Planejar campanhas de anúncios',
    explanation:'Google Ads e Meta Ads trabalham com contextos diferentes. A escolha depende do público, da oferta e dos objetivos; investimento em mídia e gestão são itens distintos.',
    slugs:['gestao-google-ads','gestao-meta-ads']
  }
];
const knownCodes=new Set();
export const guideGoals=Object.freeze(guide.map(item=>{
  if(knownCodes.has(item.code) || item.slugs.some(slug=>!bySlug.has(slug)))
    throw new Error('Invalid curated service guide');
  knownCodes.add(item.code);
  return Object.freeze({...item,slugs:Object.freeze([...item.slugs])});
}));

const choices=Object.freeze(Object.fromEntries(guideGoals.map(item=>[
  item.code,
  Object.freeze({
    code:item.code,
    explanation:item.explanation,
    services:Object.freeze(item.slugs.map(slug=>Object.freeze({
      slug,label:bySlug.get(slug).label,href:'/servicos/'+slug+'/',
      contactHref:'/contato/#'+slug
    })))
  })
])));

/** Unknown user values fail closed and are never echoed into the DOM. */
export function guideForGoal(code){
  if(typeof code!=='string' || !Object.hasOwn(choices,code))
    throw new Error('Invalid public service guide goal');
  return choices[code];
}

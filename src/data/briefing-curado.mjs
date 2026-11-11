/**
 * F142 — Briefing público baseado somente em valores pré-aprovados.
 * Sem texto livre, perfil de visitante, persistência, analytics ou envio.
 */
import {composeCuratedContactLinks} from './contact-objectives.mjs';

export const briefingStages=Object.freeze([
  Object.freeze({code:'iniciando',label:'Estou iniciando o projeto'}),
  Object.freeze({code:'reformulando',label:'Preciso reformular o que existe'}),
  Object.freeze({code:'evoluindo',label:'Quero evoluir uma operação ativa'})
]);

export const briefingPriorities=Object.freeze([
  Object.freeze({code:'oferta',label:'Explicar melhor minha oferta'}),
  Object.freeze({code:'contatos',label:'Receber mais contatos'}),
  Object.freeze({code:'presenca',label:'Organizar minha presença digital'})
]);

function curatedLabel(items,code,kind){
  if(typeof code!=='string'||(code!==''&&!items.some(item=>item.code===code)))
    throw new Error('F142: unsupported public '+kind);
  return code===''?'':items.find(item=>item.code===code).label;
}

export function composeCuratedBriefingLinks(serviceSlug='',objectiveCode='',stageCode='',priorityCode=''){
  const base=composeCuratedContactLinks(serviceSlug,objectiveCode);
  const stageLabel=curatedLabel(briefingStages,stageCode,'stage');
  const priorityLabel=curatedLabel(briefingPriorities,priorityCode,'priority');
  const message=base.message+
    (stageLabel?' Momento: '+stageLabel+'.':'')+
    (priorityLabel?' Prioridade: '+priorityLabel+'.':'');
  // Mantém o limite dos canais públicos F36 inclusive no caso mais longo.
  if(message.length>280)throw new Error('F142: curated public briefing too long');
  return Object.freeze({
    message,subject:base.subject,objectiveLabel:base.objectiveLabel,
    stageLabel,priorityLabel
  });
}

for(const items of [briefingStages,briefingPriorities]){
  if(items.length!==3||new Set(items.map(item=>item.code)).size!==items.length||
    items.some(item=>!/^[a-z-]+$/.test(item.code)||item.label.length>45))
    throw new Error('F142: invalid public briefing catalog');
}

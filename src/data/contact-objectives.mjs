/**
 * F71 — curated, public contact objectives.
 * Only an existing service slug and optional predefined objective are included
 * in visitor-initiated WhatsApp/mailto links. Never accept arbitrary free text.
 */
import {services} from './services.mjs';

export const contactObjectives=Object.freeze([
  Object.freeze({code:'novo-projeto',label:'Criar um novo projeto digital'}),
  Object.freeze({code:'melhorar-site',label:'Melhorar um site existente'}),
  Object.freeze({code:'campanhas',label:'Planejar campanhas de anúncios'}),
  Object.freeze({code:'orientacao',label:'Entender qual solução faz sentido'})
]);

const serviceLabels=new Map(services.map(service=>[service.slug,service.label]));
const objectiveLabels=new Map(contactObjectives.map(goal=>[goal.code,goal.label]));

function allowedLabel(code,labels,type){
  if(typeof code!=='string'||(code!==''&&!labels.has(code)))
    throw new Error('F71: unsupported public '+type);
  return code===''?'':labels.get(code);
}

export function composeCuratedContactLinks(serviceSlug='',objectiveCode=''){
  const service=allowedLabel(serviceSlug,serviceLabels,'service');
  const objective=allowedLabel(objectiveCode,objectiveLabels,'objective');
  const message=service
    ? 'Olá, gostaria de solicitar uma proposta para '+service+' da Imagine.'
    : 'Olá, gostaria de conhecer os serviços da Imagine.';
  const subject=service?'Proposta Imagine - '+service:'Contato Imagine';
  const result=Object.freeze({
    message:message+(objective?' Objetivo: '+objective+'.':''),
    subject:subject+(objective?' - '+objective:''),
    objectiveLabel:objective
  });
  if(result.message.length>280||result.subject.length>120)
    throw new Error('F71: public contact message length exceeded');
  return result;
}

if(contactObjectives.length!==4||
  new Set(contactObjectives.map(goal=>goal.code)).size!==contactObjectives.length||
  services.some(service=>!serviceLabels.has(service.slug)))
  throw new Error('F71: invalid curated contact objectives');

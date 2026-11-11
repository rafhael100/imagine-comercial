import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from '../src/data/services.mjs';
import {contactObjectives} from '../src/data/contact-objectives.mjs';
import {briefingStages,briefingPriorities,composeCuratedBriefingLinks} from '../src/data/briefing-curado.mjs';
import {contactWhatsAppUrl,contactEmailUrl} from '../src/data/contact-channels.mjs';
import {
  isCuratedPublicMessage,isCuratedPublicSubject,isCuratedPublicSubjectBody
} from '../src/data/curated-channel-text.mjs';

test('F159: both URL constructors accept all 560 reviewed contact combinations',()=>{
  let count=0;
  for(const service of ['',...services.map(x=>x.slug)])
  for(const objective of ['',...contactObjectives.map(x=>x.code)])
  for(const stage of ['',...briefingStages.map(x=>x.code)])
  for(const priority of ['',...briefingPriorities.map(x=>x.code)]){
    const {message,subject}=composeCuratedBriefingLinks(service,objective,stage,priority);
    assert.equal(isCuratedPublicMessage(message),true);
    assert.equal(isCuratedPublicSubject(subject),true);
    assert.equal(isCuratedPublicSubjectBody(subject,message),true);
    assert.equal(new URL(contactWhatsAppUrl(message)).searchParams.get('text'),message);
    const email=new URL(contactEmailUrl(subject,message));
    assert.equal(email.searchParams.get('subject'),subject);
    assert.equal(email.searchParams.get('body'),message);
    count++;
  }
  assert.equal(count,560);
});
test('F159: a correct-looking prefix or pasted free text never passes constructors',()=>{
  for(const fake of [
    'Olá, gostaria de conhecer os serviços da Imagine. Insira seu CPF.',
    'Olá, gostaria de conhecer os serviços da Imagine. Prioridade: Urgente depósito.',
    'Olá, gostaria de solicitar um orçamento para Imagine.',
    'Olá, gostaria de conhecer os serviços da Imagine. '
  ]){
    assert.equal(isCuratedPublicMessage(fake),false);
    assert.throws(()=>contactWhatsAppUrl(fake),/outside curated intent/);
  }
  for(const fake of [
    'Contato Imagine - preciso fornecer senha',
    'Proposta Imagine - serviço inexistente',
    'Contato Imagine ',
    'Contato Imagine - pagamento pendente'
  ]){
    assert.equal(isCuratedPublicSubject(fake),false);
    assert.throws(()=>contactEmailUrl(fake),/outside curated intent/);
  }
});
test('F159: mailto subject/body association is checked, not just independent allowlists',()=>{
  const landing=composeCuratedBriefingLinks('landing-pages','campanhas','iniciando','contatos');
  const sites=composeCuratedBriefingLinks('criacao-de-sites','orientacao','evoluindo','presenca');
  assert.notEqual(landing.subject,sites.subject);
  assert.equal(isCuratedPublicSubject(landing.subject),true);
  assert.equal(isCuratedPublicMessage(sites.message),true);
  assert.equal(isCuratedPublicSubjectBody(landing.subject,sites.message),false);
  assert.throws(()=>contactEmailUrl(landing.subject,sites.message),/F142: email body outside curated intent/);
  const altered=landing.message+' \u2603';
  assert.throws(()=>contactEmailUrl(landing.subject,altered),/outside curated intent/);
  assert.throws(()=>contactEmailUrl(landing.subject,null),/F36: invalid public email body/);
});
test('F159: proof helpers are pure predicates and do not expose mutable allowlist sets',()=>{
  for(const invalid of [undefined,null,{},[],23,true]){
    assert.equal(isCuratedPublicMessage(invalid),false);
    assert.equal(isCuratedPublicSubject(invalid),false);
    assert.equal(isCuratedPublicSubjectBody('Contato Imagine',invalid),false);
  }
});

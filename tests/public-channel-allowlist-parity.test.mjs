import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from '../src/data/services.mjs';
import {contactObjectives,composeCuratedContactLinks} from '../src/data/contact-objectives.mjs';
import {briefingStages,briefingPriorities,composeCuratedBriefingLinks} from '../src/data/briefing-curado.mjs';
import {contactWhatsAppUrl,contactEmailUrl} from '../src/data/contact-channels.mjs';
import {reviewPublicLinks} from '../src/lib/public-link-review.mjs';
import {isApprovedPublicExternalHref} from '../src/lib/outbound-link-contract.mjs';

const check=href=>reviewPublicLinks([{href}],{currentPath:'/contato/'});

test('F159: all 560 approved briefing combinations pass identical browser and build audit',()=>{
 let checked=0;
 for(const service of ['',...services.map(x=>x.slug)])
 for(const objective of ['',...contactObjectives.map(x=>x.code)])
 for(const stage of ['',...briefingStages.map(x=>x.code)])
 for(const priority of ['',...briefingPriorities.map(x=>x.code)]){
   const briefing=composeCuratedBriefingLinks(service,objective,stage,priority);
   const wa=contactWhatsAppUrl(briefing.message);
   const mail=(stage||priority)
     ?contactEmailUrl(briefing.subject,briefing.message)
     :contactEmailUrl(briefing.subject);
   for(const href of [wa,mail]){
     assert.equal(isApprovedPublicExternalHref(href),true);
     assert.equal(check(href).external,1);
   }
   checked++;
 }
 assert.equal(checked,560);
});

test('F159: no broad Olá/Imagine or Contato prefix exceptions survive browser audit',()=>{
 const approved=composeCuratedContactLinks('criacao-de-sites');
 const valid=contactWhatsAppUrl(approved.message);
 const invalid=[
   contactWhatsAppUrl('Olá, Imagine este texto nunca foi aprovado.'),
   contactEmailUrl('Contato Imagine - Injetado não aprovado'),
   valid+'&utm_source=secret',
   valid.replace('%2C','%2c'),
   valid.replace('Ol%C3%A1','Ol%C3%A1%20'),
   'mailto:imagine@imaginecomunicacao.com.br?subject=Contato%20Imagine&body=Ol%C3%A1%2C%20Imagine%20dados%20privados.',
   'https://portal.imaginecomunicacao.com.br/login',
 ];
 for(const href of invalid){
   assert.throws(()=>check(href),/external destination not in reviewed channel allowlist/,href);
 }
});

test('F159: error output never repeats an injected query or private token',()=>{
 const secret='F159-PERSONAL-TOKEN-6093';
 const href=contactWhatsAppUrl('Olá, Imagine '+secret+'.');
 assert.throws(()=>check(href),err=>{
   assert.equal(err.message.includes(secret),false);
   return /external destination not in reviewed channel allowlist/.test(err.message);
 });
});

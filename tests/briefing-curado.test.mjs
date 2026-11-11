import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';
import {contactObjectives} from '../src/data/contact-objectives.mjs';
import {contactWhatsAppUrl,contactEmailUrl} from '../src/data/contact-channels.mjs';
import {reviewPublicLinks} from '../src/lib/public-link-review.mjs';
import {
  briefingStages,briefingPriorities,composeCuratedBriefingLinks
} from '../src/data/briefing-curado.mjs';

const contactSource=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');

test('F142: combinações públicas permanecem legíveis e cabem em WhatsApp e mailto',()=>{
  for(const service of ['',...services.map(item=>item.slug)])
  for(const objective of ['',...contactObjectives.map(item=>item.code)])
  for(const stage of ['',...briefingStages.map(item=>item.code)])
  for(const priority of ['',...briefingPriorities.map(item=>item.code)]){
    const result=composeCuratedBriefingLinks(service,objective,stage,priority);
    assert.ok(Object.isFrozen(result));
    assert.ok(result.message.length<=280);
    assert.ok(result.subject.length<=120);
    assert.equal(new URL(contactWhatsAppUrl(result.message)).searchParams.get('text'),result.message);
    const mail=new URL(contactEmailUrl(result.subject,result.message));
    assert.equal(mail.searchParams.get('subject'),result.subject);
    assert.equal(mail.searchParams.get('body'),result.message);
    if(stage)assert.ok(result.message.includes(result.stageLabel));
    if(priority)assert.ok(result.message.includes(result.priorityLabel));
  }
  assert.equal(composeCuratedBriefingLinks().message,
    'Olá, gostaria de conhecer os serviços da Imagine.');
});

test('F142: auditor F32 autoriza apenas subject/body esperado em mailto',()=>{
  const payload=composeCuratedBriefingLinks('landing-pages','campanhas','iniciando','contatos');
  const allowed=contactEmailUrl(payload.subject,payload.message);
  const review=reviewPublicLinks([{href:allowed}],{currentPath:'/contato/'});
  assert.equal(review.external,1);
  for(const bad of [
    allowed+'&bcc=attacker%40example.org',
    allowed+'&body=Outro%20texto',
    allowed+'&subject=Duplicado',
    'mailto:imagine@imaginecomunicacao.com.br?body=Ol%C3%A1%2C%20Imagine'
  ])assert.throws(()=>reviewPublicLinks([{href:bad}],{currentPath:'/contato/'}),/allowlist/);
  assert.throws(()=>contactEmailUrl('Contato Imagine','texto livre'),/F142:/);
});

test('F142: recusa strings livres, protótipos e seleções externas',()=>{
  const invalid=[null,23,{},['contatos'],'__proto__','<script>','telefone=11999999999'];
  for(const value of invalid){
    assert.throws(()=>composeCuratedBriefingLinks('', '',value,''),/unsupported public stage/);
    assert.throws(()=>composeCuratedBriefingLinks('', '','',value),/unsupported public priority/);
  }
  assert.ok(briefingStages.every(Object.isFrozen));
  assert.ok(briefingPriorities.every(Object.isFrozen));
});

test('F142: contato mostra os seletores e prévia, mas não realiza captação',()=>{
  assert.match(contactSource,/id="stage-choice"/);
  assert.match(contactSource,/id="priority-choice"/);
  assert.match(contactSource,/id="message-preview"[^>]*aria-live="polite"/);
  assert.match(contactSource,/composeCuratedBriefingLinks\(choice\.value,objective\.value,stage\.value,priority\.value\)/);
  assert.match(contactSource,/stage\.addEventListener\('change', update\)/);
  assert.match(contactSource,/priority\.addEventListener\('change', update\)/);
  assert.match(contactSource,/contactEmailUrl\(emailSubject,whatsappMessage\)/);
  assert.doesNotMatch(contactSource,/<form\b|<textarea\b|<input\b|fetch\(|sendBeacon\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie|innerHTML/);
});

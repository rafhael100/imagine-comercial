import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';
import {contactObjectives,composeCuratedContactLinks} from '../src/data/contact-objectives.mjs';
import {contactWhatsAppUrl,contactEmailUrl} from '../src/data/contact-channels.mjs';

test('F71: two optional curated dimensions produce safe outbound contact URLs',()=>{
  assert.equal(contactObjectives.length,4);
  assert.equal(new Set(contactObjectives.map(x=>x.code)).size,4);
  const serviceSlugs=['',...services.map(x=>x.slug)];
  const goals=['',...contactObjectives.map(x=>x.code)];
  for(const service of serviceSlugs)for(const goal of goals){
    const result=composeCuratedContactLinks(service,goal);
    assert.ok(Object.isFrozen(result));
    assert.ok(result.message.length<=280&&result.subject.length<=120);
    assert.match(result.message,/^Olá,/);
    assert.ok(result.message.includes('Imagine'));
    const whatsapp=new URL(contactWhatsAppUrl(result.message));
    const email=contactEmailUrl(result.subject);
    assert.equal(whatsapp.hostname,'wa.me');
    assert.equal(whatsapp.searchParams.get('text'),result.message);
    assert.ok(email.startsWith('mailto:'));
    assert.equal(new URL(email).searchParams.get('subject'),result.subject);
    if(goal)assert.ok(result.message.includes(contactObjectives.find(x=>x.code===goal).label));
  }
  const generic=composeCuratedContactLinks();
  assert.equal(generic.message,'Olá, gostaria de conhecer os serviços da Imagine.');
  assert.equal(generic.subject,'Contato Imagine');
});
test('F71: arbitrary goal, service or injected text cannot enter messages',()=>{
  for(const invalid of ['__proto__','<script>','Mensagem de visitante','senha=abc',null,23,{},['campanhas']]){
    assert.throws(()=>composeCuratedContactLinks('',invalid),/unsupported public objective/);
    assert.throws(()=>composeCuratedContactLinks(invalid,''),/unsupported public service/);
  }
});
test('F71: only public service slugs stay in URL; objective is local and no data is submitted',()=>{
  const source=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  assert.match(source,/contactObjectives\.map/);
  assert.match(source,/id="objective-choice"[^>]*aria-describedby="objective-help"/);
  assert.match(source,/id="objective-help" role="status" aria-live="polite"/);
  assert.match(source,/composeCuratedContactLinks\(choice\.value,objective\.value\)/);
  assert.match(source,/objective\.addEventListener\('change', update\)/);
  assert.match(source,/allowedObjectives\.has\(objective\.value\)/);
  assert.match(source,/window\.location\.pathname \+ window\.location\.search \+ fragment/);
  assert.doesNotMatch(source,/<form\b|<textarea\b|<input\b|fetch\(|sendBeacon\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie|innerHTML/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';
import {composeCuratedContactLinks} from '../src/data/contact-objectives.mjs';
import {contactChannels,contactEmailUrl,contactWhatsAppUrl}
  from '../src/data/contact-channels.mjs';
import {isApprovedPublicExternalHref}
  from '../src/lib/outbound-link-contract.mjs';

test('F365 direct service email prepares exact approved body with no visitor data',()=>{
  assert.ok(services.length>=6);
  for(const service of services){
    const intent=composeCuratedContactLinks(service.slug);
    const emailHref=contactEmailUrl(intent.subject,intent.message);
    const email=new URL(emailHref);
    assert.equal(email.protocol,'mailto:');
    assert.equal(email.pathname,contactChannels.email);
    assert.equal(email.searchParams.get('subject'),intent.subject);
    assert.equal(email.searchParams.get('body'),intent.message);
    assert.equal(new URL(contactWhatsAppUrl(intent.message)).searchParams.get('text'),
      email.searchParams.get('body'));
    assert.equal(isApprovedPublicExternalHref(emailHref),true);
    assert.equal(isApprovedPublicExternalHref(emailHref+'&utm_source=forged'),false);
    assert.throws(()=>contactEmailUrl(intent.subject,intent.message+' visitante 123'),
      /F142: email body outside curated intent/);
  }
});

test('F365 service template uses catalog message for static mailto without sending',()=>{
  const template=readFileSync(new URL('../src/pages/servicos/[slug].astro',import.meta.url),'utf8');
  assert.match(template,/contactEmailUrl\(contactIntent\.subject,contactIntent\.message\)/);
  assert.match(template,/data-service-whatsapp/);
  assert.match(template,/data-service-email/);
  assert.match(template,/Este site não registra sua solicitação/);
  assert.doesNotMatch(template,/<form\b|fetch\(|XMLHttpRequest|localStorage|document\.cookie/);
});

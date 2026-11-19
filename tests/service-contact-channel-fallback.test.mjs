import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';
import {composeCuratedContactLinks} from '../src/data/contact-objectives.mjs';
import {contactWhatsAppUrl,contactEmailUrl,contactChannels} from '../src/data/contact-channels.mjs';

const source=readFileSync(new URL('../src/pages/servicos/[slug].astro',import.meta.url),'utf8');

test('F74: each reviewed service has a WhatsApp and email fallback without visitor data',()=>{
  for(const service of services){
    const intent=composeCuratedContactLinks(service.slug);
    const wa=new URL(contactWhatsAppUrl(intent.message));
    const mail=new URL(contactEmailUrl(intent.subject));
    assert.equal(wa.hostname,'wa.me');
    assert.equal(wa.searchParams.get('text'),intent.message);
    assert.equal(mail.protocol,'mailto:');
    assert.equal(mail.pathname,contactChannels.email);
    assert.equal(mail.searchParams.get('subject'),intent.subject);
    assert.ok(intent.message.includes(service.label));
    assert.ok(intent.subject.includes(service.label));
    assert.doesNotMatch(intent.message,/https?:\/\/|@|[\r\n]/);
    assert.doesNotMatch(intent.subject,/https?:\/\/|@|[\r\n]/);
  }
});

test('F74: service detail exposes both safe links and accessible external-channel warning',()=>{
  assert.match(source,/import \{contactWhatsAppUrl,contactEmailUrl\}/);
  assert.match(source,/const contactIntent=composeCuratedContactLinks\(s.slug\)/);
  assert.match(source,/const directEmailHref=contactEmailUrl\(contactIntent.subject\)/);
  assert.match(source,/data-service-whatsapp href=\{directWhatsAppHref\} target="_blank" rel="noopener noreferrer" aria-describedby="service-whatsapp-notice"/);
  assert.match(source,/data-service-email href=\{directEmailHref\} aria-describedby="service-whatsapp-notice"/);
  assert.match(source,/WhatsApp e e-mail abrem aplicativos externos/);
  assert.match(source,/revise e confirme o envio no aplicativo escolhido/);
  assert.doesNotMatch(source,/<form\b|<input\b|<textarea\b|fetch\(|sendBeacon\(|XMLHttpRequest|localStorage|sessionStorage/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contactChannels,contactWhatsAppUrl,contactEmailUrl}
  from '../src/data/contact-channels.mjs';
import {reviewPublicLinks} from '../src/lib/public-link-review.mjs';

test('F36 — public channels match the historically observed official contact source',()=>{
  assert.equal(contactChannels.email,'imagine@imaginecomunicacao.com.br');
  assert.equal(contactChannels.phoneE164,'+558530329525');
  assert.equal(contactChannels.whatsappE164,'5585996632689');
  assert.equal(contactChannels.whatsappBaseHref,'https://wa.me/5585996632689');
  assert.equal(contactChannels.reference,
    'https://www.imaginecomunicacao.com.br/fale-conosco.html');
  assert.equal(contactChannels.observedOn,'2026-11-09');
  assert.ok(Object.isFrozen(contactChannels));
});

test('F36 — contact builders encode default intent without transmitting visitor data',()=>{
  const whatsapp=new URL(contactWhatsAppUrl());
  assert.equal(whatsapp.hostname,'wa.me');
  assert.equal(whatsapp.pathname,'/5585996632689');
  assert.equal(whatsapp.searchParams.get('text'),
    'Olá, gostaria de conhecer os serviços da Imagine.');
  assert.equal(contactEmailUrl(),
    'mailto:imagine@imaginecomunicacao.com.br?subject=Contato%20Imagine');
  assert.equal(reviewPublicLinks([{href:contactWhatsAppUrl()},
    {href:contactEmailUrl()},{href:'tel:'+contactChannels.phoneE164}],
  {currentPath:'/contato/'}).external,3);
});

test('F36 — selected service preserves exact message and subject and allowlist',()=>{
  const message='Olá, gostaria de solicitar uma proposta para Landing Pages da Imagine.';
  const subject='Proposta Imagine - Landing Pages';
  const whatsapp=contactWhatsAppUrl(message);
  const email=contactEmailUrl(subject);
  assert.equal(new URL(whatsapp).searchParams.get('text'),message);
  assert.equal(new URL(email).searchParams.get('subject'),subject);
  const audit=reviewPublicLinks([{href:whatsapp},{href:email}],{
    currentPath:'/contato/'
  });
  assert.equal(audit.external,2);
  assert.equal(audit.checked,2);
});

test('F36 — messages and subjects cannot inject headers or arbitrary data',()=>{
  for(const bad of [
    'Oi', 'Imagine', 'Olá, Imagine\nBcc: attacker@example.com',
    'Olá, Imagine\r\n', 'Olá, Imagine\0', 'Olá, Imagine '+ 'x'.repeat(300)
  ]) assert.throws(()=>contactWhatsAppUrl(bad),/F36: /);
  for(const bad of [
    'Hello', 'Assunto externo', 'Contato Imagine\r\nBcc: someone@example.com',
    'Contato Imagine\0', 'Proposta Imagine '+'a'.repeat(140)
  ]) assert.throws(()=>contactEmailUrl(bad),/F36: /);
});

test('F36 — contact and link audit import the same source of truth',()=>{
  const contact=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
  const links=readFileSync(new URL('../src/lib/public-link-review.mjs',import.meta.url),'utf8');
  assert.match(contact,/from '\.\.\/data\/contact-channels\.mjs'/);
  assert.match(contact,/contactWhatsAppUrl\(whatsappMessage\)/);
  assert.match(contact,/contactEmailUrl\(emailSubject\)/);
  assert.match(links,/from '\.\.\/data\/contact-channels\.mjs'/);
  assert.match(links,/contactChannels\.whatsappE164/);
  assert.match(links,/contactChannels\.email/);
  assert.match(links,/contactChannels\.phoneE164/);
  assert.doesNotMatch(contact,/fetch\(|<form\b|document\.cookie|localStorage/);
});

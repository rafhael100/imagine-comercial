import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';
import {composeCuratedContactLinks} from '../src/data/contact-objectives.mjs';
import {contactWhatsAppUrl,contactEmailUrl} from '../src/data/contact-channels.mjs';
import {isApprovedPublicExternalHref} from '../src/lib/outbound-link-contract.mjs';
const source=readFileSync(new URL('../src/pages/contato.astro',import.meta.url),'utf8');
test('F208 six approved services have static outbound options without script',()=>{
  assert.equal(services.length,6);
  const urls=new Set();
  for(const service of services){
    const intent=composeCuratedContactLinks(service.slug);
    const whats=contactWhatsAppUrl(intent.message),mail=contactEmailUrl(intent.subject);
    assert.ok(isApprovedPublicExternalHref(whats));
    assert.ok(isApprovedPublicExternalHref(mail));
    urls.add(whats);urls.add(mail);
  }
  assert.equal(urls.size,12);
});
test('F208 Astro noscript renders a reviewed service-specific contact card',()=>{
  assert.match(source,/<noscript>/);
  assert.match(source,/noJsContacts\.map\(item=>/);
  assert.match(source,/data-nojs-contact={item.slug}/);
  assert.match(source,/id={item.slug}/);
  assert.match(source,/data-nojs-whatsapp href={item.whatsappHref}/);
  assert.match(source,/data-nojs-email href={item.emailHref}/);
  assert.match(source,/target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(source,/<form\b|<textarea\b|<input\b|fetch\s*\(|localStorage|sessionStorage/);
});

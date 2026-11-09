import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from '../src/data/services.mjs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('all service CTAs keep their original slug only as a location hash',()=>{
  const view=source('src/pages/servicos/[slug].astro');
  assert.equal((view.match(/href=\{'\/contato\/#' \+ s.slug\}/g)||[]).length,2);
  for(const service of services)assert.match(service.slug,/^[a-z0-9-]+$/);
});
test('contact options are curated and do not trigger an unapproved lead API',()=>{
  const contact=source('src/pages/contato.astro');
  assert.ok(contact.includes('services.map(s => <option value={s.slug}'));
  assert.ok(contact.includes('allowed.includes(requested)'));
  assert.ok(contact.includes('contactWhatsAppUrl(whatsappMessage)'));
  assert.ok(contact.includes('contactEmailUrl(emailSubject)'));
  assert.doesNotMatch(contact,/<form\b|fetch\(|localStorage|document\.cookie|XMLHttpRequest/);
});
test('contact remains functional without JavaScript',()=>{
  const contact=source('src/pages/contato.astro');
  assert.ok(contact.includes('id="contact-whatsapp" href={contactWhatsAppUrl()}'));
  assert.ok(contact.includes('id="contact-email" href={contactEmailUrl()}'));
  assert.ok(contact.includes('href={"tel:"+contactChannels.phoneE164}'));
  assert.ok(contact.includes('contactChannels.email'));
});

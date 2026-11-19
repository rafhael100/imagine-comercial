import test from 'node:test';
import assert from 'node:assert/strict';
import {localizedSalesMessages} from '../src/data/localized-sales-messages.mjs';
import {localizedSalesWhatsAppUrl} from '../src/data/localized-sales-contact.mjs';
import {contactChannels,contactWhatsAppUrl} from '../src/data/contact-channels.mjs';
import {services} from '../src/data/services.mjs';
const validSlugs=new Set(services.map(item=>item.slug));

test('F323: seven approved offers in EN and ES have fixed WhatsApp links',()=>{
 for(const locale of ['en','es']){
  assert.deepEqual(new Set(Object.keys(localizedSalesMessages[locale])),validSlugs);
  for(const [slug,message] of Object.entries(localizedSalesMessages[locale])){
   const url=localizedSalesWhatsAppUrl(locale,slug);
   const parsed=new URL(url);
   assert.equal(parsed.origin,'https://wa.me');
   assert.equal(parsed.pathname,'/'+contactChannels.whatsappE164);
   assert.equal(parsed.searchParams.size,1);
   assert.equal(parsed.searchParams.get('text'),message);
   assert.equal(url,contactWhatsAppUrl(message));
   assert.ok(message.length<280);
   assert.doesNotMatch(message,/\b\d{8,}\b|@|\btoken\b|https?:\/\//i);
  }
 }
});
test('F323: unknown locale, slug or prototype key fails closed',()=>{
 for(const pair of [['pt-BR','onepage'],['fr','onepage'],['en','x'],['es','__proto__'],['en','constructor'],['en','toString']])
  assert.throws(()=>localizedSalesWhatsAppUrl(...pair),/Unreviewed/);
 assert.equal(Object.keys(localizedSalesMessages).length,2);
});

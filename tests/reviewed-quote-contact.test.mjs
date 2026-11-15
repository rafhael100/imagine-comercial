import test from 'node:test';
import assert from 'node:assert/strict';
import {QUOTE_LOCALES,REVIEWED_QUOTE_MESSAGES,reviewedQuoteChoiceMessage} from '../src/data/reviewed-quote-choice-messages.mjs';
import {reviewedQuoteChoiceHref} from '../src/data/reviewed-quote-choice-href.mjs';
import {contactChannels,contactWhatsAppUrl} from '../src/data/contact-channels.mjs';
import {isApprovedPublicExternalHref} from '../src/lib/outbound-link-contract.mjs';

test('F324: only 138 fixed quote messages in 3 languages, no personal data',()=>{
 assert.deepEqual(QUOTE_LOCALES,['pt-BR','en','es']);
 let count=0;
 for(const locale of QUOTE_LOCALES){
  assert.equal(Object.keys(REVIEWED_QUOTE_MESSAGES[locale]).length,46);
  for(const site of ['none','onepage','landing-pages'])
   for(const channels of [[],['google_ads'],['meta_ads'],['google_ads','meta_ads']])
    for(const tier of ['minimum','recommended']){
     const selection={site,channels,tier};
     if(site==='none'&&channels.length===0)
      assert.throws(()=>reviewedQuoteChoiceHref(locale,selection));
     else{
      const message=reviewedQuoteChoiceMessage(locale,selection);
      const url=reviewedQuoteChoiceHref(locale,selection);
      assert.equal(url,contactWhatsAppUrl(message));
      assert.equal(new URL(url).pathname,'/'+contactChannels.whatsappE164);
      assert.ok(isApprovedPublicExternalHref(url));
      assert.ok(message.length<=280);
      assert.doesNotMatch(message,/\b\d{8,}\b|@|https?:\/\//);
      assert.match(url, /^https:\/\/wa\.me\//);
      count++;
     }
    }
 }
 assert.equal(count,66);
});
test('F324: unknown locales, products, channels and tiers fail closed',()=>{
 for(const [locale,selection] of [
  ['fr',{site:'onepage',channels:[],tier:'minimum'}],
  ['pt-BR',{site:'constructor',channels:[],tier:'minimum'}],
  ['en',{site:'none',channels:['unknown_ads'],tier:'minimum'}],
  ['es',{site:'onepage',channels:['meta_ads','meta_ads'],tier:'minimum'}],
  ['en',{site:'onepage',channels:['google_ads'],tier:'other'}],
 ]){
  assert.throws(()=>reviewedQuoteChoiceHref(locale,selection));
 }
});

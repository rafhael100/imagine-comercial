import test from 'node:test';
import assert from 'node:assert/strict';
import {CALCULATOR_CONTACT_OPTIONS,calculatorContactKey,reviewedCalculatorContact}
 from '../src/data/calculator-contact-messages.mjs';
import {contactWhatsAppUrl} from '../src/data/contact-channels.mjs';
import {isCuratedPublicMessage} from '../src/data/curated-channel-text.mjs';

const ALL=['chatgpt_ads','google_ads','meta_ads'];
test('F315 all 21 channel/locale combinations are finite and pass existing contact allowlist',()=>{
 let count=0;
 for(const locale of ['pt','en','es']){
  const options=CALCULATOR_CONTACT_OPTIONS[locale];
  assert.equal(options.length,7);
  assert.ok(Object.isFrozen(options));
  const keys=new Set();
  for(const option of options){
   count++;
   assert.equal(option.locale,locale);
   assert.ok(!keys.has(option.key));keys.add(option.key);
   assert.equal(option.key,option.channels.join('+'));
   assert.equal(option.key,calculatorContactKey(option.channels));
   assert.equal(option.message,reviewedCalculatorContact(locale,option.channels).message);
   assert.ok(Object.isFrozen(option));
   assert.ok(Object.isFrozen(option.channels));
   assert.equal(isCuratedPublicMessage(option.message),true);
   assert.ok(option.message.length<280);
   assert.ok(option.message.length>=40);
   assert.doesNotMatch(option.message,/\b(?:CPF|CNPJ|e-mail|email|phone|telefone|@)\b|R\$|\d{2,}/i);
   const url=contactWhatsAppUrl(option.message);
   assert.ok(url.startsWith('https://wa.me/5585996632689?text='));
   assert.equal(decodeURIComponent(new URL(url).searchParams.get('text')),option.message);
   assert.ok(!url.includes('token=')&&!url.includes('api/lead'));
  }
 }
 assert.equal(count,21);
});
test('F315 rejects user-supplied free text, invalid channel ids, duplicates, sparse/getter arrays',()=>{
 for(const invalid of [
  [],['meta_ads','meta_ads'],['meta_ads','user@email.test'],
  ['meta_ads','hello'],['fake_ads'],['meta_ads','google_ads','chatgpt_ads','fake'],
  'meta_ads',null,{'0':'meta_ads',length:1}
 ]){
  assert.throws(()=>calculatorContactKey(invalid),/F315:/);
 }
 assert.throws(()=>reviewedCalculatorContact('de',['meta_ads']),/F315:/);
 const tricky=['meta_ads'];
 Object.defineProperty(tricky,'0',{enumerable:true,get(){throw Error('SECRETS_MUST_NOT_BE_EVALUATED')}});
 assert.throws(()=>calculatorContactKey(tricky),/F315:/);
 const inherited=['meta_ads'];
 Object.setPrototypeOf(inherited,{});
 assert.throws(()=>calculatorContactKey(inherited),/F315:/);
 const sparse=['meta_ads','google_ads'];delete sparse[1];
 assert.throws(()=>calculatorContactKey(sparse),/F315:/);
});
test('F315 selected contact is independent from numeric budget, and cannot include unapproved text',()=>{
 const m=reviewedCalculatorContact('pt',ALL).message;
 assert.ok(m.includes('Meta Ads'));
 assert.ok(m.includes('Google Ads'));
 assert.ok(m.includes('ChatGPT Ads'));
 assert.equal(m,reviewedCalculatorContact('pt',['meta_ads','google_ads','chatgpt_ads']).message);
 assert.throws(()=>contactWhatsAppUrl('Meu orçamento: R$ 99999 / Dados pessoais'),/curated intent/);
});

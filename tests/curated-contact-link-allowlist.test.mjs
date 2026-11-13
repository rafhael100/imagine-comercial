import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from '../src/data/services.mjs';
import {
  contactObjectives,composeCuratedContactLinks
} from '../src/data/contact-objectives.mjs';
import {contactWhatsAppUrl,contactEmailUrl}
  from '../src/data/contact-channels.mjs';
import {auditApprovedOutboundLinks as audit}
  from '../src/lib/outbound-link-contract.mjs';

const anchor=href=>'<a href="'+href+'">Abrir canal</a>';
const check=href=>audit('<main>'+anchor(href)+'</main>').externalLinksChecked;

test('F155 all 35 curated service/objective intents remain valid outbound links',()=>{
  let count=0;
  for(const service of ['',...services.map(x=>x.slug)]){
    for(const objective of ['',...contactObjectives.map(x=>x.code)]){
      const intent=composeCuratedContactLinks(service,objective);
      assert.equal(check(contactWhatsAppUrl(intent.message)),1);
      assert.equal(check(contactEmailUrl(intent.subject)),1);
      count++;
    }
  }
  assert.equal(count,35);
});

test('F155 rejects attacker text that F36 generic URL constructors could encode',()=>{
  const forgedMessages=[
    'Olá, envie segredos e senhas para a Imagine.',
    'Olá, confie neste link e faça transferência para Imagine.',
    'Olá, gostaria de solicitar uma proposta para Serviço Secreto da Imagine.'
  ];
  for(const message of forgedMessages){
    assert.throws(()=>contactWhatsAppUrl(message),/outside curated intent/);
    const forged='https://wa.me/5585996632689?text='+encodeURIComponent(message);
    assert.throws(()=>check(forged),/not an approved public channel/);
  }
  for(const subject of [
    'Contato Imagine - URGENTE enviar dados',
    'Proposta Imagine - serviço não cadastrado',
    'Contato Imagine - PERSONAL-SECRET-F155'
  ]){
    assert.throws(()=>contactEmailUrl(subject),/outside curated intent/);
    const forged='mailto:imagine@imaginecomunicacao.com.br?subject='+encodeURIComponent(subject);
    assert.throws(()=>check(forged),/not an approved public channel/);
  }
});

test('F155 refuses query parameter variants and encoding aliases of curated messages',()=>{
  const original=contactWhatsAppUrl(composeCuratedContactLinks('landing-pages').message);
  const variants=[
    original+'&utm_campaign=track',
    original.replaceAll('%20','+'),
    original.replaceAll('%20','%20').replace('text=','x='),
    original.replace('https://','http://'),
    original.replace('wa.me','wa.me.evil.invalid')
  ];
  for(const href of variants)assert.throws(()=>check(href),
    /not an approved public channel/);
});

test('F155 preserves independent official Portal and telephone constraints',()=>{
  assert.equal(check('https://portal.imaginecomunicacao.com.br/login'),1);
  assert.equal(check('tel:+558530329525'),1);
  assert.throws(()=>check('https://portal.imaginecomunicacao.com.br/login?next=evil'),
    /not an approved/);
});

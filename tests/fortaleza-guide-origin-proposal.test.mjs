import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {articles} from '../src/data/articles.mjs';
import {reviewedFortalezaGuideContact as intent}
  from '../src/data/reviewed-guide-contact.mjs';
import {contactChannels,contactWhatsAppUrl}
  from '../src/data/contact-channels.mjs';
import {isApprovedPublicExternalHref} from '../src/lib/outbound-link-contract.mjs';
import {reviewPublicLinks} from '../src/lib/public-link-review.mjs';

test('F361 attributes the already-published Fortaleza guide without inventing a destination',()=>{
  assert.equal(intent.articleSlug,'criacao-de-sites-fortaleza-guia');
  assert.equal(intent.serviceSlug,'criacao-de-sites');
  assert.equal(articles.filter(a=>a.slug===intent.articleSlug).length,1);
  assert.equal(intent.message.includes('Origem editorial: guia de criação de sites em Fortaleza.'),true);
  assert.ok(Object.isFrozen(intent));
  const href=contactWhatsAppUrl(intent.message);
  const url=new URL(href);
  assert.equal(url.origin,'https://wa.me');
  assert.equal(url.pathname,'/'+contactChannels.whatsappE164);
  assert.equal(url.searchParams.get('text'),intent.message);
  assert.equal(isApprovedPublicExternalHref(href),true);
  assert.equal(reviewPublicLinks([{href,target:'_blank',rel:'noopener noreferrer'}],{
    currentPath:'/conteudos/'+intent.articleSlug+'/'
  }).external,1);
});

test('F361 rejects altered source markers, tracking parameters and visitor-authored text',()=>{
  const href=contactWhatsAppUrl(intent.message);
  for(const forged of [href+'&utm_source=ads',href.replace('Fortaleza','Sobral'),
    href.replace('text=','contact=')])
    assert.equal(isApprovedPublicExternalHref(forged),false);
  for(const message of [intent.message+' ID de cliente 123',
    'Visitei uma URL e quero uma proposta','Origem: '+new URL('https://example.invalid').href])
    assert.throws(()=>contactWhatsAppUrl(message),/F36: /);
});

test('F361 candidate renders contextual CTA only for the existing guide',()=>{
  const source=readFileSync(new URL('../src/pages/conteudos/[slug].astro',import.meta.url),'utf8');
  assert.match(source,/article.slug===reviewedFortalezaGuideContact.articleSlug/);
  assert.match(source,/data-guide-origin-proposal/);
  assert.match(source,/guide-channel-notice/);
  assert.match(source,/href=\{contactIntent.href\}/);
  assert.match(source,/href="\/contato\/"/);
  assert.doesNotMatch(source,/<form\b|fetch\(|XMLHttpRequest|localStorage|document\.cookie/);
});

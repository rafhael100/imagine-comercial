import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {articles} from '../src/data/articles.mjs';
import {reviewedFortalezaGuideContact as intent}
  from '../src/data/reviewed-guide-contact.mjs';
import {contactChannels,contactWhatsAppUrl,contactEmailUrl}
  from '../src/data/contact-channels.mjs';
import {composeCuratedContactLinks} from '../src/data/contact-objectives.mjs';
import {isApprovedPublicExternalHref,auditApprovedOutboundLinks}
  from '../src/lib/outbound-link-contract.mjs';
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
  const subject=composeCuratedContactLinks(intent.serviceSlug).subject;
  const emailHref=contactEmailUrl(subject,intent.message);
  const email=new URL(emailHref);
  assert.equal(email.pathname,contactChannels.email);
  assert.equal(email.searchParams.get('subject'),subject);
  assert.equal(email.searchParams.get('body'),intent.message);
  assert.equal(isApprovedPublicExternalHref(emailHref),true);
  // Regression: HTML serialization encodes the mailto query separator.
  const html='<a href="'+emailHref.replaceAll('&','&amp;')+'">Email</a>';
  assert.equal(auditApprovedOutboundLinks(html).externalLinksChecked,1);
  assert.throws(()=>auditApprovedOutboundLinks(html.replace('&amp;body=','&amp;utm_source=bad&amp;body=')),
    /F149:/);
  assert.equal(reviewPublicLinks([
    {href,target:'_blank',rel:'noopener noreferrer'},
    {href:emailHref}
  ],{currentPath:'/conteudos/'+intent.articleSlug+'/'}).external,2);
});

test('F361 rejects altered source markers, tracking parameters and visitor-authored text',()=>{
  const href=contactWhatsAppUrl(intent.message);
  for(const forged of [href+'&utm_source=ads',href.replace('Fortaleza','Sobral'),
    href.replace('text=','contact=')])
    assert.equal(isApprovedPublicExternalHref(forged),false);
  for(const message of [intent.message+' ID de cliente 123',
    'Visitei uma URL e quero uma proposta','Origem: '+new URL('https://example.invalid').href])
    assert.throws(()=>contactWhatsAppUrl(message),/F36: /);
  const subject=composeCuratedContactLinks(intent.serviceSlug).subject;
  assert.throws(()=>contactEmailUrl(subject,intent.message+' visitor-ID'),/F142: /);
  assert.equal(isApprovedPublicExternalHref(
    contactEmailUrl(subject,intent.message)+'&utm_source=private'),false);
});

test('F361 candidate renders contextual CTA only for the existing guide',()=>{
  const source=readFileSync(new URL('../src/pages/conteudos/[slug].astro',import.meta.url),'utf8');
  assert.match(source,/article.slug===reviewedFortalezaGuideContact.articleSlug/);
  assert.match(source,/data-guide-origin-proposal/);
  assert.match(source,/data-guide-origin-email/);
  assert.match(source,/guide-channel-notice/);
  assert.match(source,/href=\{contactIntent.href\}/);
  assert.match(source,/href="\/contato\/"/);
  assert.doesNotMatch(source,/<form\b|fetch\(|XMLHttpRequest|localStorage|document\.cookie/);
});

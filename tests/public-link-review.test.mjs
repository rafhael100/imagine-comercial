import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPublicLinks} from '../src/lib/public-link-review.mjs';
import {contactChannels,contactWhatsAppUrl,contactEmailUrl} from '../src/data/contact-channels.mjs';
import {composeCuratedContactLinks,contactObjectives} from '../src/data/contact-objectives.mjs';
import {services} from '../src/data/services.mjs';
import {briefingStages,briefingPriorities,composeCuratedBriefingLinks} from '../src/data/briefing-curado.mjs';

const review=(links,currentPath='/',ids=['conteudo'])=>reviewPublicLinks(
  links.map(x=>typeof x==='string'?{href:x}:x),
  {currentPath,fragmentIds:ids}
);

test('F32 allows curated internal routes, skip link and contact intent only',()=>{
  const r=review([
    '/', '/servicos/', '/servicos/landing-pages/','/conteudos/landing-page-ou-site/',
    '#conteudo','/contato/#landing-pages'
  ]);
  assert.deepEqual(r,{checked:6,internal:6,external:0,sameDocument:1});
  assert.ok(Object.isFrozen(r));
});

test('F32 allows only exact operational contact channels',()=>{
  const r=review([
    {href:contactWhatsAppUrl(composeCuratedContactLinks('landing-pages').message),
     target:'_blank',rel:'noopener noreferrer'},
    {href:contactChannels.whatsappBaseHref,target:'_blank',rel:'noreferrer noopener'},
    {href:contactEmailUrl()},
    {href:contactEmailUrl(composeCuratedContactLinks('landing-pages').subject)},
    {href:'tel:'+contactChannels.phoneE164}
  ]);
  assert.equal(r.external,5);
});


test('F158 DOM and build auditors both require reviewed 560 briefing variants',()=>{
  let combinations=0;
  for(const service of ['',...services.map(x=>x.slug)])
  for(const objective of ['',...contactObjectives.map(x=>x.code)])
  for(const stage of ['',...briefingStages.map(x=>x.code)])
  for(const priority of ['',...briefingPriorities.map(x=>x.code)]){
    const result=composeCuratedBriefingLinks(service,objective,stage,priority);
    const hrefs=[contactWhatsAppUrl(result.message)];
    if(stage||priority)hrefs.push(contactEmailUrl(result.subject,result.message));
    else hrefs.push(contactEmailUrl(result.subject));
    for(const href of hrefs)assert.equal(review([{href}],'/contato/').external,1);
    combinations++;
  }
  assert.equal(combinations,560);
});

test('F158 DOM auditor rejects crafted WhatsApp messages and mailto pretexts',()=>{
  for(const malicious of [
    'Olá, favor fornecer dados bancários à Imagine.',
    'Olá, peça acesso administrativo do cliente Imagine.',
    'Olá, valor de pagamento alterado pela Imagine.'
  ]){
    assert.throws(()=>contactWhatsAppUrl(malicious),/outside curated intent/);
    assert.throws(()=>review(['https://wa.me/5585996632689?text='+encodeURIComponent(malicious)],'/contato/'),
      /external destination not in reviewed channel allowlist/);
  }
  for(const subject of ['Contato Imagine - VERIFICACAO PRIVADA',
    'Proposta Imagine - serviço inventado']){
    assert.throws(()=>contactEmailUrl(subject),/outside curated intent/);
    assert.throws(()=>review(['mailto:imagine@imaginecomunicacao.com.br?subject='+encodeURIComponent(subject)],'/contato/'),
      /external destination not in reviewed channel allowlist/);
  }
  const curated=composeCuratedBriefingLinks('onepage','orientacao','iniciando','oferta');
  const ok=contactEmailUrl(curated.subject,curated.message);
  assert.equal(review([ok],'/contato/').external,1);
  for(const malformed of [ok+'&bcc=private%40evil.invalid',
    ok.replace('&body=','&body=TENHO-DADOS-REAIS-'),
    ok.replace('%20','+')] )
    assert.throws(()=>review([malformed],'/contato/'),/external destination/);
});

test('F32 blocks broken internal routes and disallowed hash fragments',()=>{
  for(const href of [
    '/servicos/pagina-inexistente/','/servicos/landing-pages',
    '/admin/','/checkout/','/contato/#falso-servico',
    '/sobre/#conteudo','/conteudos/landing-page-ou-site/#no-section'
  ]) assert.throws(()=>review([href]),/internal route missing|broken or unapproved fragment/);
});

test('F32 blocks domain lookalikes, marketing links and unsafe protocols',()=>{
  for(const href of [
    'https://evil.invalid/','https://wa.me.evil.invalid/5585996632689',
    'https://wa.me/5511999999999','http://wa.me/5585996632689',
    'javascript:alert(1)','data:text/html,hello','//evil.invalid/',
    'mailto:someone@example.com','tel:+5511999999999',
    'https://portal.imaginecomunicacao.com.br/login?access_token=secret'
  ]) assert.throws(()=>review([href]),/unapproved|external destination|unsafe/);
});

test('F32 rejects query variants, encoded URL paths, traversal and unsafe anchors',()=>{
  for(const href of [
    '/contato/?token=secret','/servicos/%2e%2e/contato/',
    '/a/../contato/','/servicos//landing-pages/','/contato/#unknown',
    'https://wa.me/5585996632689?token=secret',
    'https://wa.me/5585996632689?text=hello',
    'mailto:imagine@imaginecomunicacao.com.br?bcc=secret@example.com'
  ]) assert.throws(()=>review([href]),/unsafe|missing|fragment|destination/);
});

test('F32 new-tab links must have noopener and noreferrer',()=>{
  for(const rel of ['','noopener','noreferrer','nofollow']) {
    assert.throws(()=>review([{href:'https://wa.me/5585996632689',
      target:'_blank',rel}]),/noopener noreferrer/);
  }
  assert.throws(()=>review([{href:'tel:+558530329525',target:'sidepane'}]),/unapproved target/);
});

test('F32 error descriptions cannot echo URL query tokens or contact data',()=>{
  const secret='maria.private-token-3091';
  assert.throws(()=>review(['/contato/?token='+secret]),err=>{
    assert.equal(err.message.includes(secret),false);
    return /unsafe or ambiguous internal URL/.test(err.message);
  });
  assert.throws(()=>review(['https://evil.invalid/?token='+secret]),err=>{
    assert.equal(err.message.includes(secret),false);
    return /external destination not in reviewed channel allowlist/.test(err.message);
  });
});

test('F32 validates declared source route, link input and relative href',()=>{
  assert.throws(()=>reviewPublicLinks([],{currentPath:'/not-indexable/'}),/validated source route/);
  assert.throws(()=>review([{}]),/invalid href/);
  assert.throws(()=>review(['contato/']),/relative link/);
});

test('F32 skip-to-content on 404 is valid but the 404 itself stays out of sitemap',()=>{
  assert.equal(review(['#conteudo'],'/404/').sameDocument,1);
  assert.throws(()=>review(['/404/']),/internal route missing from sitemap/);
});

test('F33: a configured official Portal login URL is allowed only if exact',()=>{
  const approved='https://portal.imaginecomunicacao.com.br/login';
  assert.equal(reviewPublicLinks([{href:approved}],{
    currentPath:'/',approvedPortalLoginUrl:approved
  }).external,1);
  assert.throws(()=>review([approved]),/external destination not in reviewed channel allowlist/);
  for(const changed of [
    approved+'?next=https://evil.invalid/',
    'https://evil.imaginecomunicacao.com.br/login',
    'https://portal.imaginecomunicacao.com.br/other-login',
    'http://portal.imaginecomunicacao.com.br/login'
  ]) {
    assert.throws(()=>reviewPublicLinks([{href:changed}],{
      currentPath:'/',approvedPortalLoginUrl:approved
    }),/external destination not in reviewed channel allowlist|unapproved URL scheme/);
  }
});

test('F33: an untrusted configured value cannot broaden link destinations',()=>{
  const bad='https://portal.imaginecomunicacao.com.br.evil.invalid/login';
  assert.throws(()=>reviewPublicLinks([{href:bad}],{
    currentPath:'/',approvedPortalLoginUrl:bad
  }),/external destination not in reviewed channel allowlist/);
  assert.throws(()=>reviewPublicLinks([{
    href:'https://portal.imaginecomunicacao.com.br/login',
    target:'_blank',rel:'noopener'
  }],{
    currentPath:'/',approvedPortalLoginUrl:'https://portal.imaginecomunicacao.com.br/login'
  }),/new tab lacks noopener noreferrer/);
});

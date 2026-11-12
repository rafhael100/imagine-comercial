import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPublicLinks} from '../src/lib/public-link-review.mjs';
import {contactWhatsAppUrl,contactEmailUrl,contactChannels} from '../src/data/contact-channels.mjs';
import {composeCuratedContactLinks} from '../src/data/contact-objectives.mjs';

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

test('F159 allows only exact reviewed contact-channel URLs',()=>{
  const intent=composeCuratedContactLinks('criacao-de-sites','novo-projeto');
  const r=review([
    {href:contactWhatsAppUrl(intent.message),
     target:'_blank',rel:'noopener noreferrer'},
    {href:contactChannels.whatsappBaseHref,target:'_blank',rel:'noreferrer noopener'},
    {href:contactEmailUrl()},
    {href:contactEmailUrl(intent.subject)},
    {href:'tel:'+contactChannels.phoneE164}
  ]);
  assert.equal(r.external,5);
  for(const unreviewed of [
    'https://wa.me/5585996632689?text=Ol%C3%A1%2C%20Imagine%20-%20uma%20proposta.',
    'mailto:imagine@imaginecomunicacao.com.br?subject=Proposta%20Imagine%20-%20Sites'
  ])assert.throws(()=>review([unreviewed]),/external destination/);
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

test('F190 allows exactly the eight public FAQ question anchors across pages',()=>{
  const sections=['escopo','contratacao','midia','operacao'];
  const approved=['escolha','materiais','precos','revisoes',
    'midia','resultados','portal','acessos'];
  assert.equal(sections.length,4);
  for(const question of approved){
    assert.equal(review(['/perguntas-frequentes/#duvida-'+question],
      '/servicos/onepage/').internal,1);
  }
  for(const bad of ['duvida-falso','duvida-__proto__','faq-escopo',
    'duvida-precos-extra','duvida-maria@example.invalid']){
    assert.throws(()=>review(['/perguntas-frequentes/#'+bad],
      '/servicos/onepage/'),/broken or unapproved fragment/);
  }
});

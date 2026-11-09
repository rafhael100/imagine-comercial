import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPublicLinks} from '../src/lib/public-link-review.mjs';

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
    {href:'https://wa.me/5585996632689?text=Ol%C3%A1%2C%20Imagine%20-%20uma%20proposta.',
     target:'_blank',rel:'noopener noreferrer'},
    {href:'https://wa.me/5585996632689',target:'_blank',rel:'noreferrer noopener'},
    {href:'mailto:imagine@imaginecomunicacao.com.br?subject=Contato%20Imagine'},
    {href:'mailto:imagine@imaginecomunicacao.com.br?subject=Proposta%20Imagine%20-%20Sites'},
    {href:'tel:+558530329525'}
  ]);
  assert.equal(r.external,5);
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

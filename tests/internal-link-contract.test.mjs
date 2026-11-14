import test from 'node:test';
import assert from 'node:assert/strict';
import {sitePages} from '../src/data/services.mjs';
import {auditCuratedInternalLinks as audit}
  from '../src/lib/internal-link-contract.mjs';

const routes=sitePages.map(x=>x.path);
const html=(links)=>'<html><body>'+links.map(href=>
  '<a href="'+href+'">Continue lendo</a>').join('')+'</body></html>';

test('F143 approves published service, guide, and contact links with fragments',()=>{
  const result=audit(html([
    '/','/servicos/criacao-de-sites/','/conteudos/criacao-de-sites-fortaleza-guia/',
    '/contato/#landing-pages','#conteudo',
    'https://wa.me/5511999999999?text=Oi&amp;source=site',
    'mailto:contato@example.com','tel:+5585999999999'
  ]),routes);
  assert.equal(result.checkedLinks,8);
  assert.equal(result.networkPerformed,false);
  assert.ok(Object.isFrozen(result));
});

test('F143 rejects absent routes, malformed slashes and unapproved variants',()=>{
  for(const href of [
    '/servicos/servico-inexistente/',
    '/conteudos/guia-inexistente/',
    '/admin/','/portal/','/servicos/criacao-de-sites',
    '/servicos//criacao-de-sites/','//evil.invalid/path',
    '/conteudos/%2e%2e/','/contato/?session=secret',
    '/contato/#','/contato/#bad fragment',
    'servicos/criacao-de-sites/','../contato/','javascript:alert(1)',
    'data:text/html,hello', 'http://invalid.example/'
  ])assert.throws(()=>audit(html([href]),routes),undefined,href);
});

test('F143 fails closed for route catalog drift and missing anchor href',()=>{
  assert.throws(()=>audit(html(['/']),['/','/']),/duplicate route catalog/);
  assert.throws(()=>audit(html(['/']),['/','/url?bad/']),/invalid route catalog/);
  assert.throws(()=>audit('<a>link without href</a>',routes),/link without href/);
  assert.throws(()=>audit('<html><body></body></html>',routes),/expected public navigation/);
});

test('F143 does not print private link contents to thrown errors',()=>{
  try{
    audit(html(['/contato/?token=PERSONAL-SECRET-F143']),routes);
    assert.fail('private query should be rejected');
  }catch(error){
    assert.doesNotMatch(String(error),/PERSONAL-SECRET-F143/);
  }
});

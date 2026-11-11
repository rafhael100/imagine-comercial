import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePortalLoginLink} from '../src/lib/portal-login-link.mjs';

test('F29: omit Portal access unless explicitly configured',()=>{
  for(const value of [undefined,null,'',false,0,{},[],true]){
    assert.equal(resolvePortalLoginLink(value),'');
  }
});

test('F29: allow only exact official HTTPS portal hosts with simple paths',()=>{
  assert.equal(
    resolvePortalLoginLink('https://portal.imaginecomunicacao.com.br/login'),
    'https://portal.imaginecomunicacao.com.br/login'
  );
  assert.equal(
    resolvePortalLoginLink('https://imaginecomunicacao.com.br/auth/login/'),
    'https://imaginecomunicacao.com.br/auth/login/'
  );
  assert.equal(
    resolvePortalLoginLink('https://PORTAL.IMAGINECOMUNICACAO.COM.BR/'),
    'https://portal.imaginecomunicacao.com.br/'
  );
});

test('F29: deny subdomain wildcards, lookalikes, userinfo and foreign schemes',()=>{
  for(const value of [
    'https://evil.imaginecomunicacao.com.br/login',
    'https://portal.imaginecomunicacao.com.br.evil.invalid/',
    'https://imaginecomunicacao.com.br.attacker.invalid/',
    'https://imaginecomunicacao-com-br.com/login',
    'https://user:password@portal.imaginecomunicacao.com.br/login',
    'https://user@portal.imaginecomunicacao.com.br/login',
    'http://portal.imaginecomunicacao.com.br/login',
    'javascript:alert(1)',
    '//portal.imaginecomunicacao.com.br/login',
    'https://portal.imaginecomunicacao.com.br:444/login',
    'https://portal.imaginecomunicacao.com.br#token'
  ]) assert.equal(resolvePortalLoginLink(value),'',value);
});

test('F29: never propagate tokens in URL query, hash, encoded path or traversal',()=>{
  for(const value of [
    'https://portal.imaginecomunicacao.com.br/login?session=private-token',
    'https://portal.imaginecomunicacao.com.br/login#auth-secret',
    'https://portal.imaginecomunicacao.com.br/a/../login',
    'https://portal.imaginecomunicacao.com.br/a/./login',
    'https://portal.imaginecomunicacao.com.br/a/%2e%2e/login',
    'https://portal.imaginecomunicacao.com.br/%6cogin',
    'https://portal.imaginecomunicacao.com.br//login',
    'https://portal.imaginecomunicacao.com.br/login\\another',
    ' https://portal.imaginecomunicacao.com.br/login ',
    'https://portal.imaginecomunicacao.com.br/login%0d%0aSet-Cookie'
  ]) assert.equal(resolvePortalLoginLink(value),'',value);
});

test('F29: malicious URL does not become a link in generated page',()=>{
  assert.equal(resolvePortalLoginLink('https://portal.imaginecomunicacao.com.br/login?next=https://evil.invalid'), '');
  assert.equal(resolvePortalLoginLink('https://portal.imaginecomunicacao.com.br/login'), 'https://portal.imaginecomunicacao.com.br/login');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CANONICAL_ORIGIN,HOST_POLICY_STATUS,getCanonicalHostPolicy,reviewCanonicalOrigin} from '../src/lib/canonical-host-policy.mjs';

test('F225: canonical root domain is consistent with Astro configuration',()=>{
  const astro=readFileSync(new URL('../astro.config.mjs',import.meta.url),'utf8');
  assert.equal(CANONICAL_ORIGIN,'https://imaginecomunicacao.com.br');
  assert.match(astro,/site:\s*'https:\/\/imaginecomunicacao\.com\.br'/);
  assert.equal(HOST_POLICY_STATUS,'APPROVED_TARGET_ONLY_REDIRECTS_NOT_AUTHORIZED');
});
test('F225: all four schemes/hostnames are classified, but no real 301 approved',()=>{
  const policy=getCanonicalHostPolicy();
  assert.equal(policy.variants.length,4);
  assert.equal(policy.authorizedRedirectRules,0);
  assert.equal(policy.productionAuthorized,false);
  for(const origin of policy.variants){
    const row=reviewCanonicalOrigin(origin);
    assert.equal(row.canonical,origin===CANONICAL_ORIGIN);
    assert.equal(row.canonicalOrigin,CANONICAL_ORIGIN);
    assert.equal(row.redirectStatus,'NOT_AUTHORIZED');
    assert.equal(row.authorizedRedirectRules,0);
    assert.equal(row.productionAuthorized,false);
    assert.equal(row.dnsChangeAuthorized,false);
  }
});
test('F225: reject spoofed origins, ports, credentials, paths and casing variants',()=>{
  for(const origin of ['https://imaginecomunicacao.com.br.evil.test',
    'https://user@imaginecomunicacao.com.br','https://imaginecomunicacao.com.br:443',
    'https://imaginecomunicacao.com.br/foo','https://www.imaginecomunicacao.com.br?x=1',
    'HTTPS://imaginecomunicacao.com.br','http://evil.test',null,{},'']){
    assert.throws(()=>reviewCanonicalOrigin(origin));
  }
});
test('F225: policy is immutable and not a redirect-deployment artifact',()=>{
  const policy=getCanonicalHostPolicy();
  assert.ok(Object.isFrozen(policy));
  assert.ok(Object.isFrozen(policy.variants));
  assert.equal(policy.variants[0],'http://imaginecomunicacao.com.br');
  assert.ok(policy.variants.every(x=>!x.includes('/_redirects')));
});

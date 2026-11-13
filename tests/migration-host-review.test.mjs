import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewCanonicalHostMigration as review}
  from '../src/lib/migration-host-review.mjs';
const old='https://www.imaginecomunicacao.com.br/';
const newSite='https://imaginecomunicacao.com.br/';
test('F222 previously indexed www vs Astro root host remains HOLD until operator decision',()=>{
  const result=review({legacyOrigin:old,candidateOrigin:newSite});
  assert.equal(result.hostChangeProposed,true);
  assert.equal(result.requiresPerHostRedirectReview,true);
  assert.equal(result.requiresCanonicalSitemapAndHreflangReview,true);
  assert.equal(result.liveHttpAndTlsVerified,false);
  assert.equal(result.dnsChangeAuthorized,false);
  assert.equal(result.redirectsAuthorized,false);
  assert.equal(result.canPublish,false);
  assert.ok(Object.isFrozen(result));
});
test('F222 agreeing hosts still do not authorize go-live or pretend Google verification',()=>{
  const result=review({legacyOrigin:newSite,candidateOrigin:newSite});
  assert.equal(result.hostChangeProposed,false);
  assert.equal(result.requiresPerHostRedirectReview,false);
  assert.equal(result.oldAndNewGscPropertyVerified,false);
  assert.equal(result.independentSeoApprovalVerified,false);
  assert.equal(result.canPublish,false);
});
test('F222 denies unsafe or unreviewed hosts, URL paths, queries or credentials',()=>{
  for(const invalid of [
    'http://www.imaginecomunicacao.com.br/',
    'https://www.imaginecomunicacao.com.br/servicos/',
    'https://www.imaginecomunicacao.com.br/?token=private',
    'https://www.imaginecomunicacao.com.br/#fragment',
    'https://user:pass@www.imaginecomunicacao.com.br/',
    'https://imaginecomunicacao.com.br.evil.test/',
    'https://www.imaginecomunicacao.com.br:444/',
    'https://www.imaginecomunicacao.com.br',
    'javascript:alert(1)',undefined,null,{}
  ])assert.throws(()=>review({legacyOrigin:invalid,candidateOrigin:newSite}));
});
test('F222 checked Astro origin must come from actual current source, no shadow hostname',()=>{
  const astro=readFileSync(new URL('../astro.config.mjs',import.meta.url),'utf8');
  assert.match(astro,/site: 'https:\/\/imaginecomunicacao\.com\.br'/);
  const parsed=astro.match(/site:\s*'(https:\/\/[^']+)'/);
  const policy=review({legacyOrigin:old,candidateOrigin:parsed[1]+'/'});
  assert.equal(policy.hostChangeProposed,true);
  assert.equal(policy.canPublish,false);
});

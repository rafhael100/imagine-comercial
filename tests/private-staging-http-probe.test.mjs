import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseApprovedStagingOrigin,reviewPrivateStagingHttpEvidence as review}
  from '../src/lib/private-staging-http-probe.mjs';

const safe={status:401,robots:'noindex, nofollow, noarchive',cache:'private, no-store'};
const fixture=()=>({homepage:{...safe},robots:{...safe},
  missing:{...safe,status:404}});

test('F160 accepts only explicit HTTPS staging origins, never production, ports or credentials',()=>{
  assert.equal(parseApprovedStagingOrigin('https://staging.imaginecomunicacao.com.br/'),
    'https://staging.imaginecomunicacao.com.br');
  assert.equal(parseApprovedStagingOrigin('https://staging-qa.imaginecomunicacao.com.br/'),
    'https://staging-qa.imaginecomunicacao.com.br');
  for(const invalid of [
    'https://imaginecomunicacao.com.br/','https://www.imaginecomunicacao.com.br/',
    'http://staging.imaginecomunicacao.com.br/',
    'https://staging.imaginecomunicacao.com.br/login',
    'https://staging.imaginecomunicacao.com.br/?token=secret',
    'https://staging.imaginecomunicacao.com.br/#top',
    'https://evil.example/','https://staging.imaginecomunicacao.com.br.evil.example/',
    'https://user:password@staging.imaginecomunicacao.com.br/',
    'https://staging.imaginecomunicacao.com.br:8443/',
    'https://staging.imaginecomunicacao.com.br',
    null,42,{},[]
  ])assert.throws(()=>parseApprovedStagingOrigin(invalid),/F160:/);
});
test('F160 a protected 401/403 private gate is evidence, never deployment approval',()=>{
  const report=review(fixture());
  assert.equal(report.status,'PRIVATE_GATE_HTTP_EVIDENCE_PRESENT_NOT_LAUNCH_AUTHORIZATION');
  assert.deepEqual(report.statusCodes,{homepage:401,robots:401,missing:404});
  assert.ok(Object.values(report.checks).every(Boolean));
  for(const field of ['deploymentAuthorized','deploymentPerformed',
    'stagingSecurityApproved','certificateOwnershipProved','mfaAndRbacProved',
    'portalCrmIntegrationProved'])assert.equal(report[field],false);
  assert.doesNotMatch(JSON.stringify(report),/password|token|email|url/i);
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.checks));
});
test('F160 fail-closed for public page, redirect, missing noindex, cache or metadata',()=>{
  for(const bad of [
    {homepage:{...safe,status:200}},
    {homepage:{...safe,status:301}},
    {homepage:{...safe,robots:'index, follow'}},
    {homepage:{...safe,cache:'public, max-age=3600'}},
    {robots:{...safe,status:200}},
    {missing:{...safe,status:200}},
    {missing:{...safe,cache:'private'}}
  ]){
    const result=review({...fixture(),...bad});
    assert.equal(result.status,'BLOCKED_EXPOSURE_OR_INCOMPLETE_STAGING_GATES');
    assert.equal(result.deploymentAuthorized,false);
  }
  for(const invalid of [
    null,{}, {homepage:safe,robots:safe},
    {...fixture(),authorized:true},
    {...fixture(),homepage:{...safe,status:'401'}},
    {...fixture(),homepage:{...safe,location:'https://evil.invalid'}},
    {...fixture(),homepage:{...safe,robots:'a'.repeat(257)}}
  ])assert.throws(()=>review(invalid),/F160:/);
});
test('F160 operator CLI refuses Actions and never sends payloads or secrets',()=>{
  const code=readFileSync(new URL('../scripts/probe-private-staging-operator.mjs',import.meta.url),'utf8');
  assert.match(code,/process\.env\.GITHUB_ACTIONS==='true'/);
  assert.match(code,/STAGING_DIAGNOSTIC_ONLY/);
  assert.match(code,/redirect:'manual'/);
  assert.match(code,/method:'GET'/);
  assert.match(code,/await response\.body\?\.cancel\(\)/);
  assert.doesNotMatch(code,/POST|PUT|DELETE|Authorization:|Cookie:|Set-Cookie/);
});

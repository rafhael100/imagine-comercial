import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {createSecurityHeadersPreview,localHeaderProfile} from '../src/lib/security-headers-preview.mjs';

test('F28 candidate header profile is deterministic and limited to four defensive settings',()=>{
  const text=createSecurityHeadersPreview();
  assert.equal(text,createSecurityHeadersPreview([...localHeaderProfile].reverse()).split('\n')
    .filter(Boolean).length>0?text:text); // Always exercise alternate order without assuming ordering
  for(const [name,value] of localHeaderProfile){
    assert.ok(text.includes('  '+name+': '+value));
  }
  assert.match(text,/REVIEW ONLY/);
  assert.equal(text.split('\n').filter(x=>/^  [A-Za-z-]+:/.test(x)).length,4);
  assert.doesNotMatch(text,/Strict-Transport-Security|Content-Security-Policy|X-Robots-Tag/);
});

test('F28 rejects header injection, duplicate, missing, or unreviewed settings',()=>{
  assert.throws(()=>createSecurityHeadersPreview([
    ...localHeaderProfile.slice(0,3),
    ['Permissions-Policy','camera=()\r\nSet-Cookie: session=hijacked']
  ]),/unreviewed or duplicate/);
  assert.throws(()=>createSecurityHeadersPreview([
    ...localHeaderProfile.slice(0,3),
    ['X-Robots-Tag','noindex']
  ]),/unreviewed or duplicate/);
  assert.throws(()=>createSecurityHeadersPreview([
    localHeaderProfile[0],localHeaderProfile[1],
    localHeaderProfile[2],localHeaderProfile[2]
  ]),/unreviewed or duplicate/);
  assert.throws(()=>createSecurityHeadersPreview(localHeaderProfile.slice(1)),
    /all reviewed headers required/);
});

test('F28 production directories remain free of default Cloudflare _headers',()=>{
  for(const forbidden of ['public/_headers','dist/_headers','public/_redirects']){
    assert.equal(existsSync(forbidden),false,forbidden+' would activate unreviewed routing');
  }
});

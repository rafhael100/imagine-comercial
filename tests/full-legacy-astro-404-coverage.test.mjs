import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {sitePages} from '../src/data/services.mjs';

test('F162 browser tests must cover all 25 known legacy URLs without sampling',()=>{
  const source=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');
  const candidates=legacyUrls.filter(x=>x.status==='candidate');
  const held=legacyUrls.filter(x=>x.status==='hold');
  assert.equal(candidates.length,5);
  assert.equal(held.length,20);
  assert.equal(new Set(legacyUrls.map(x=>x.from)).size,25);
  assert.ok(legacyUrls.every(x=>!sitePages.some(p=>p.path===x.from)));
  assert.match(source,/const candidates=legacyUrls\.filter\(item=>item\.status==='candidate'\);/);
  assert.match(source,/const held=legacyUrls\.filter\(item=>item\.status==='hold'\);/);
  assert.doesNotMatch(source,/legacyUrls\.filter\([^)]*\)\.slice\(0,/);
  assert.match(source,/for\(const legacy of \[\.\.\.candidates,\.\.\.held\]\)/);
  assert.match(source,/response\?\.status\(\),404/);
  assert.match(source,/noindex,nofollow/);
});

test('F162 real browser requires no redirected URL or indexed legacy markup',()=>{
  const source=readFileSync(new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');
  assert.match(source,/new URL\(page\.url\(\)\)\.pathname,legacy\.from/);
  assert.match(source,/link\[rel="canonical"\]/);
  assert.match(source,/script\[type="application\/ld\+json"\]/);
  assert.match(source,/a\[href="\/servicos\/"\]/);
});

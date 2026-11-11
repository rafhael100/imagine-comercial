import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';

test('F157 legacy candidate/hold paths remain unapproved in the catalog',()=>{
  const candidates=legacyUrls.filter(x=>x.status==='candidate');
  const held=legacyUrls.filter(x=>x.status==='hold');
  assert.equal(candidates.length,5);
  assert.equal(held.length,18);
  assert.ok(legacyUrls.every(x=>x.status!=='approved'));
  assert.ok(candidates.every(x=>x.to?.startsWith('/')));
  assert.ok(held.every(x=>x.to===null));
});

test('F157 production build cannot quietly include redirect rules',()=>{
  assert.equal(existsSync(new URL('../public/_redirects',import.meta.url)),false);
  const script=readFileSync(
    new URL('../scripts/test-workers-local-migration.mjs',import.meta.url),'utf8');
  assert.match(script,/mkdtemp\(join\(tmpdir\(\)/);
  assert.match(script,/join\(root,'dist\/_redirects'\)/);
  assert.match(script,/await rm\(root,\{recursive:true,force:true\}\)/);
  assert.match(script,/not_found_handling:'404-page'/);
});

test('F157 browser QA checks real legacy HTTP status and noindex under local preview',()=>{
  const source=readFileSync(
    new URL('../scripts/browser-qa.mjs',import.meta.url),'utf8');
  assert.match(source,/legacyUrls\.filter\(item=>item\.status==='candidate'\)/);
  assert.match(source,/legacyUrls\.filter\(item=>item\.status==='hold'\)/);
  assert.match(source,/response\?\.status\(\),404/);
  assert.match(source,/link\[rel="canonical"\]/);
  assert.match(source,/noindex,nofollow/);
  assert.match(source,/script\[type="application\/ld\+json"\]/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {legacyUrls} from '../src/data/legacy-urls.mjs';
import {sitePages} from '../src/data/services.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('F161 private staging covers every legacy HOLD entry, not a short sample',()=>{
  const held=legacyUrls.filter(x=>x.status==='hold');
  assert.equal(held.length,18);
  assert.equal(new Set(held.map(x=>x.from)).size,18);
  assert.ok(held.every(x=>x.to===null));
  assert.ok(held.every(x=>!sitePages.some(s=>s.path===x.from)));
  const source=read('src/lib/private-staging-http-gate.mjs');
  assert.match(source,/legacyUrls\.filter\(x=>x\.status==='hold'\)\.map/);
  assert.doesNotMatch(source,/\.slice\(0,4\)/);
  assert.match(source,/pendingSamples\.length!==18/);
});

test('F161 all 18 held paths are checked by real Workerd and documented',()=>{
  const code=read('scripts/test-workers-local-migration.mjs');
  assert.match(code,/privateGate\.heldLegacyPages,18/);
  assert.match(code,/privateGate\.totalHttpChecks,22/);
  assert.match(code,/const held=legacyUrls\.filter\(x=>x\.status==='hold'\)/);
  assert.match(code,/for\(const blocked of \[/);
  assert.match(code,/assert\.equal\(response\.status,404/);
});

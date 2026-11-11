import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('F160 actual Workerd loopback runs the same F159 private staging gate',()=>{
  const source=read('scripts/test-workers-local-migration.mjs');
  assert.match(source,/reviewPrivateStagingHttp\(\{port\}\)/);
  assert.match(source,/privateGate\.totalHttpChecks,8/);
  assert.match(source,/privateGate\.heldLegacyPages,4/);
  assert.match(source,/privateGate\.deploymentAuthorized,false/);
  assert.match(source,/privateGate\.deploymentPerformed,false/);
  assert.match(source,/const port=8798/);
  assert.match(source,/--local/);
  assert.match(source,/--ip','127\.0\.0\.1'/);
  assert.match(source,/mkdtemp\(join\(tmpdir\(\)/);
  assert.match(source,/await rm\(root,\{recursive:true,force:true\}\)/);
});

test('F160 private gate changes trigger real Workerd HTTP smoke in CI',()=>{
  const workflow=read('.github/workflows/commercial-cloudflare-migration-lab.yml');
  assert.match(workflow,/src\/lib\/private-staging-http-gate\.mjs/);
  assert.match(workflow,/scripts\/review-private-staging-http\.mjs/);
  assert.match(workflow,/node scripts\/test-workers-local-migration\.mjs/);
  assert.match(workflow,/WRANGLER_SEND_METRICS/);
});

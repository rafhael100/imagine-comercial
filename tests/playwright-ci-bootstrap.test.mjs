import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('F161: browser install only falls back to apt after real launch failure',()=>{
 const s=read('scripts/install-chromium-ci.sh');
 assert.match(s,/npx playwright install chromium/);
 assert.match(s,/if check_browser; then/);
 assert.match(s,/npx playwright install-deps chromium/);
 assert.match(s,/GITHUB_ACTIONS/);
 assert.match(s,/archive\.ubuntu\.com/);
 assert.match(s,/set -euo pipefail/);
 assert.doesNotMatch(s,/--force|curl.*\|\s*(?:bash|sh)|PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD/);
});
test('F161: browser workflows use the same deterministic local bootstrap',()=>{
 for(const path of [
   '.github/workflows/validate.yml',
   '.github/workflows/commercial-lighthouse-lab.yml'
 ]){
   const flow=read(path);
   assert.match(flow,/bash scripts\/install-chromium-ci\.sh/);
   assert.doesNotMatch(flow,/npx playwright install --with-deps chromium/);
   assert.match(flow,/node-version: '22'/);
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(
  new URL('../.github/workflows/comercial-f325-buyer-journey.yml', import.meta.url),'utf8'
);
const helper = await readFile(
  new URL('../scripts/install-chromium-ci.sh', import.meta.url),'utf8'
);

test('R51 F325 uses the vetted Chromium launch probe, not unconditional apt',()=>{
  assert.match(workflow,/name: Comercial F325 - jornada de compra navegavel offline/);
  assert.match(workflow,/timeout-minutes: 12/);
  assert.match(workflow,/run: bash scripts\/install-chromium-ci\.sh/);
  assert.doesNotMatch(workflow,/run: npx playwright install --with-deps chromium/);
  assert.match(workflow,/- 'scripts\/install-chromium-ci\.sh'/);
  assert.match(workflow,/- 'tests\/comercial-f325-browser-bootstrap\.test\.mjs'/);
  assert.match(workflow,/persist-credentials: false/);
  assert.match(workflow,/IMAGINE_BUYER_JOURNEY_REVIEW: '1'/);
});

test('R51 fallback verifies browser launch before and after optional apt dependencies',()=>{
  assert.match(helper,/^#!\/usr\/bin\/env bash/);
  assert.match(helper,/set -euo pipefail/);
  assert.match(helper,/npx playwright install chromium/);
  assert.match(helper,/const browser=await chromium\.launch/);
  assert.match(helper,/if check_browser; then/);
  assert.match(helper,/if \[\[ "\$GITHUB_ACTIONS" != "true" \]\]; then/);
  assert.match(helper,/npx playwright install-deps chromium/);
  assert.match(helper,/check_browser\n/);
  assert.doesNotMatch(helper,/npx playwright install --with-deps chromium/);
});

test('R51 browser workflow remains evidence-only with no public credentials or deploy',()=>{
  assert.match(workflow,/permissions:\n  contents: read/);
  assert.match(workflow,/uses: actions\/checkout@[a-f0-9]{40}/);
  assert.match(workflow,/uses: actions\/setup-node@[a-f0-9]{40}/);
  assert.match(workflow,/uses: actions\/upload-artifact@[a-f0-9]{40}/);
  assert.match(workflow,/node ops\/review\/purchase\/test-buyer-journey-browser\.mjs/);
  assert.match(workflow,/No public route, no merge, no deploy, no signup, no financial operations/);
  assert.doesNotMatch(workflow,/pull_request_target:|id-token: write|deploy-pages|aws-actions\/configure-aws-credentials/);
});

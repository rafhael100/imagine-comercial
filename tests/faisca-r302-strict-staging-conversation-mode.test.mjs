import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectFaiscaPrivateStaging } from '../ops/faisca/openai/private-staging-preflight.mjs';

const sha = 'a'.repeat(40);
const invalid = ['', 'YES', 'yes_synthetic_only', 'YES_SYNTHETIC_ONLY ',
  'NO', 'SYNTHETIC_WRONG_MODE_FIXTURE'];
function run(mode) {
  return inspectFaiscaPrivateStaging({
    expectedHead:sha, nodeVersion:'22.12.1',
    env:{
      OPENAI_API_KEY:'sk-SYNTHETIC_R302_PRIVATE_NO_REAL_CREDENTIAL',
      FAISCA_REVIEW_BEARER_TOKEN:'R302_SEPARATE_PRIVATE_TEST_TOKEN_123456',
      FAISCA_PRIVATE_LEDGER_DIR:'synthetic-fixture',
      IMAGINE_FAISCA_OPENAI_LIVE_TEST:'YES_PAY_SYNTHETIC_ONLY',
      FAISCA_PRIVATE_SYNTHETIC_CONVERSATION:mode
    },
    gitRevision:async()=>sha, isClean:async()=>true,
    checkLedger:async()=>true, checkPort:async()=>undefined
  });
}

test('R302 paid staging preflight rejects explicit mode typos instead of silently falling back', async () => {
  for (const mode of invalid) {
    const result = await run(mode);
    assert.equal(result.status,'BLOCKED_NO_START');
    assert.ok(result.failedChecks.includes('private_paid_test_opt_in'));
    assert.equal(result.realApiCalled,false);
    assert.equal(result.publicFaiscaEnabled,false);
    assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_WRONG_MODE_FIXTURE/);
  }
  for (const mode of [undefined,'YES_SYNTHETIC_ONLY']) {
    const result = await run(mode);
    assert.equal(result.status,'READY_FOR_PRIVATE_OPERATOR_START');
    assert.equal(result.productionApproved,false);
  }
});

test('R302 actual read-only CLI rejects wrong mode before making any HTTP probe', () => {
  const script = fileURLToPath(new URL('../scripts/faisca-private-staging-readonly-smoke.mjs',import.meta.url));
  for (const mode of invalid) {
    const result = spawnSync(process.execPath,[script],{
      env:{FAISCA_PRIVATE_SYNTHETIC_CONVERSATION:mode},encoding:'utf8',timeout:5000
    });
    assert.equal(result.error,undefined);
    assert.equal(result.status,2);
    assert.equal(result.stdout,'');
    assert.equal(result.stderr.trim(),'BLOCKED_INVALID_PRIVATE_CONVERSATION_MODE');
  }
});

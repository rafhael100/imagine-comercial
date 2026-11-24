import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFaiscaPrivateStaging } from '../ops/faisca/openai/private-staging-preflight.mjs';

const sha = 'a'.repeat(40);
const env = {
  OPENAI_API_KEY:'sk-R312_SYNTHETIC_NO_REAL_CREDENTIAL_123',
  FAISCA_REVIEW_BEARER_TOKEN:'R312_SYNTHETIC_REVIEW_TOKEN_123456789',
  FAISCA_PRIVATE_LEDGER_DIR:'synthetic-fixture',
  IMAGINE_FAISCA_OPENAI_LIVE_TEST:'YES_PAY_SYNTHETIC_ONLY',
  FAISCA_PRIVATE_SYNTHETIC_CONVERSATION:'YES_SYNTHETIC_ONLY'
};
function fixture(changes = {}, options = {}) {
  const seen = [];
  const run = () => inspectFaiscaPrivateStaging({
    env: {...env, ...changes}, nodeVersion:'22.12.1', expectedHead:sha,
    gitRevision:async()=>{seen.push('git');return sha;},
    isClean:async()=>{seen.push('clean');return true;},
    checkLedger:async()=>{seen.push('ledger');return true;},
    checkPort:async()=>{seen.push('port');},
    ...options
  });
  return {seen, run};
}
test('R312 CI never touches checkout, ledger or loopback probes', async () => {
  for (const changes of [{CI:'true'}, {GITHUB_ACTIONS:'true'}]) {
    const f=fixture(changes);
    const result=await f.run();
    assert.equal(result.status,'BLOCKED_NO_START');
    assert.deepEqual(f.seen,[]);
    assert.ok(result.failedChecks.includes('not_ci_or_github_actions'));
    assert.equal(result.realApiCalled,false);
    assert.equal(result.publicFaiscaEnabled,false);
  }
});
test('R312 early invalid admission gates do not touch ledger or port', async () => {
  for (const f of [
    fixture({OPENAI_API_KEY:''}),
    fixture({FAISCA_PRIVATE_SYNTHETIC_CONVERSATION:'TYPO'}),
    fixture({IMAGINE_FAISCA_OPENAI_LIVE_TEST:'NO'}),
    fixture({}, {expectedHead:'b'.repeat(40)}),
    fixture({}, {isClean:async()=>false}),
    fixture({}, {nodeVersion:'20.0.0'})
  ]) {
    const result=await f.run();
    assert.equal(result.status,'BLOCKED_NO_START');
    assert.equal(result.checks.length,10);
    assert.ok(!f.seen.includes('ledger') && !f.seen.includes('port'));
    assert.ok(result.failedChecks.includes('private_persistent_ledger_ready_without_lock'));
    assert.ok(result.failedChecks.includes('private_loopback_port_available'));
  }
});
test('R312 failed ledger prevents port bind; positive control probes once in order', async () => {
  const blocked=fixture({}, {checkLedger:async()=>false});
  assert.equal((await blocked.run()).status,'BLOCKED_NO_START');
  assert.ok(!blocked.seen.includes('port'));
  const f=fixture();
  const result=await f.run();
  assert.deepEqual(f.seen,['git','clean','ledger','port']);
  assert.equal(result.status,'READY_FOR_PRIVATE_OPERATOR_START');
  assert.deepEqual(result.failedChecks,[]);
  assert.equal(result.productionApproved,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFaiscaPrivateStaging } from '../ops/faisca/openai/private-staging-preflight.mjs';

const sha = 'a'.repeat(40);
const env = {
  OPENAI_API_KEY: 'sk-R313_FIXTURE_NOT_A_REAL_KEY_000',
  FAISCA_REVIEW_BEARER_TOKEN: 'R313_FIXTURE_REVIEW_TOKEN_000000000',
  FAISCA_PRIVATE_LEDGER_DIR: 'fixture-only',
  IMAGINE_FAISCA_OPENAI_LIVE_TEST: 'YES_PAY_SYNTHETIC_ONLY'
};
function fixture(overrides = {}, envOverrides = {}) {
  const seen = [];
  const run = () => inspectFaiscaPrivateStaging({
    expectedHead: sha, nodeVersion: '22.12.0', env: {...env, ...envOverrides},
    gitRevision: async () => { seen.push('git'); return sha; },
    isClean: async () => { seen.push('clean'); return true; },
    checkLedger: async () => { seen.push('ledger'); return true; },
    checkPort: async () => { seen.push('port'); },
    ...overrides
  });
  return {seen, run};
}
test('R313 pure invalid admission never invokes Git, ledger or port', async () => {
  for (const f of [
    fixture({expectedHead: 'invalid'}),
    fixture({nodeVersion: '22.11.9'}),
    fixture({}, {OPENAI_API_KEY: ''}),
    fixture({}, {FAISCA_REVIEW_BEARER_TOKEN: 'short'}),
    fixture({}, {IMAGINE_FAISCA_OPENAI_LIVE_TEST: 'NO'}),
    fixture({}, {FAISCA_PRIVATE_SYNTHETIC_CONVERSATION: 'invalid'}),
    fixture({}, {CI: 'true'})
  ]) {
    const report = await f.run();
    assert.equal(report.status, 'BLOCKED_NO_START');
    assert.equal(report.checks.length, 10);
    assert.deepEqual(f.seen, []);
    assert.ok(report.failedChecks.includes('reviewed_git_head_matches_pin'));
    assert.ok(report.failedChecks.includes('tracked_checkout_is_clean'));
    assert.equal(report.realApiCalled, false);
    assert.equal(report.publicFaiscaEnabled, false);
  }
});
test('R313 mismatched or failed Git revision never starts worktree scan', async () => {
  for (const gitRevision of [async () => 'b'.repeat(40), async () => { throw Error('synthetic failure'); }]) {
    const f = fixture({gitRevision});
    const report = await f.run();
    assert.equal(report.status, 'BLOCKED_NO_START');
    assert.deepEqual(f.seen, []);
    assert.ok(report.failedChecks.includes('reviewed_git_head_matches_pin'));
    assert.ok(report.failedChecks.includes('tracked_checkout_is_clean'));
  }
});
test('R313 valid admission preserves all probes in order', async () => {
  const f = fixture();
  const report = await f.run();
  assert.deepEqual(f.seen, ['git', 'clean', 'ledger', 'port']);
  assert.equal(report.status, 'READY_FOR_PRIVATE_OPERATOR_START');
  assert.deepEqual(report.failedChecks, []);
  assert.equal(report.productionApproved, false);
});

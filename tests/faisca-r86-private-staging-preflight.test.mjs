import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, writeFile, rm, symlink, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectFaiscaPrivateStaging } from '../ops/faisca/openai/private-staging-preflight.mjs';

const sha = 'a'.repeat(40);
const apiKey = 'sk-SYNTHETIC_R86_PRIVATE_NO_REAL_CREDENTIAL_123';
const token = 'R86_SEPARATE_PRIVATE_TEST_TOKEN_12345678901234';
function environment(directory, changes = {}) {
  return {
    OPENAI_API_KEY: apiKey,
    FAISCA_REVIEW_BEARER_TOKEN: token,
    FAISCA_PRIVATE_LEDGER_DIR: directory,
    IMAGINE_FAISCA_OPENAI_LIVE_TEST: 'YES_PAY_SYNTHETIC_ONLY',
    ...changes
  };
}
function run(env, values = {}) {
  return inspectFaiscaPrivateStaging({
    expectedHead: sha,
    env,
    nodeVersion: '22.12.1',
    gitRevision: async () => sha,
    isClean: async () => true,
    checkPort: async () => undefined,
    ...values
  });
}
async function temporaryLedger(t) {
  const directory = await mkdtemp(join(tmpdir(), 'faisca-r86-'));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
const hasFailure = (result, code) => result.failedChecks.includes(code);

test('R86 read-only staging preflight allows only fully reviewed and locally protected operator setup', async t => {
  const directory = await temporaryLedger(t);
  const value = await run(environment(directory));
  assert.equal(value.schema, 'faisca.private-staging-preflight.v1');
  assert.equal(value.status, 'READY_FOR_PRIVATE_OPERATOR_START');
  assert.deepEqual(value.failedChecks, []);
  assert.equal(value.checks.length, 10);
  assert.ok(value.checks.every(item => item.passed === true));
  assert.equal(value.realApiCalled, false);
  assert.equal(value.publicFaiscaEnabled, false);
  assert.equal(value.productionApproved, false);
  assert.equal(value.onlyLocalReview, true);
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /SYNTHETIC_R86_PRIVATE|R86_SEPARATE_PRIVATE|FAISCA_PRIVATE_LEDGER_DIR/);
  assert.equal(serialized.includes(directory), false, 'No operator filesystem path in preflight output');
});

test('R86 refuses absent secrets, copied key as review token, invalid opt-in, CI and old Node', async t => {
  const directory = await temporaryLedger(t);
  const bad = [
    [environment(directory, { OPENAI_API_KEY: '' }), 'openai_key_present_only_in_private_environment'],
    [environment(directory, { FAISCA_REVIEW_BEARER_TOKEN: apiKey }), 'separate_private_review_token'],
    [environment(directory, { FAISCA_REVIEW_BEARER_TOKEN: 'short' }), 'separate_private_review_token'],
    [environment(directory, { IMAGINE_FAISCA_OPENAI_LIVE_TEST: 'off' }), 'private_paid_test_opt_in'],
    [environment(directory, { CI: 'true' }), 'not_ci_or_github_actions'],
    [environment(directory, { GITHUB_ACTIONS: 'true' }), 'not_ci_or_github_actions']
  ];
  for (const [env, code] of bad) {
    const report = await run(env);
    assert.equal(report.status, 'BLOCKED_NO_START', code);
    assert.ok(hasFailure(report, code), code);
  }
  for (const nodeVersion of ['18.20.0','20.11.1','22.11.0','not-a-version']) {
    const report = await run(environment(directory), { nodeVersion });
    assert.ok(hasFailure(report, 'node_22_12_or_newer'), nodeVersion);
  }
});

test('R86 rejects drifted commit, dirty checkout and occupied loopback without touching secrets', async t => {
  const directory = await temporaryLedger(t);
  const cases = [
    [{ expectedHead: 'not-a-sha' }, 'independent_operator_sha_pin'],
    [{ gitRevision: async () => 'b'.repeat(40) }, 'reviewed_git_head_matches_pin'],
    [{ isClean: async () => false }, 'tracked_checkout_is_clean'],
    [{ checkPort: async () => { throw Error('EADDRINUSE'); } }, 'private_loopback_port_available'],
    [{ checkPort: async () => false }, 'private_loopback_port_available']
  ];
  for (const [options, code] of cases) {
    const result = await run(environment(directory), options);
    assert.equal(result.status, 'BLOCKED_NO_START');
    assert.ok(hasFailure(result, code), code);
    assert.equal(result.realApiCalled, false);
  }
});

test('R86 rejects unsafe ledger directories and existing reservation crash locks without cleanup', async t => {
  const directory = await temporaryLedger(t);
  await chmod(directory, 0o755);
  let result = await run(environment(directory));
  assert.ok(hasFailure(result, 'private_persistent_ledger_ready_without_lock'));
  await chmod(directory, 0o700);
  const link = directory + '-symlink';
  await symlink(directory, link);
  t.after(() => rm(link, { force: true }));
  result = await run(environment(link));
  assert.ok(hasFailure(result, 'private_persistent_ledger_ready_without_lock'));
  const lock = join(directory, '.faisca-reservations.lock');
  await writeFile(lock, 'synthetic crash marker\n', { mode: 0o600 });
  result = await run(environment(directory));
  assert.ok(hasFailure(result, 'private_persistent_ledger_ready_without_lock'));
  assert.equal(result.realApiCalled, false);
  // Read-only preflight must not remove an operator-owned crash lock.
  const info = await lstat(lock);
  assert.equal(info.isFile(), true);
});

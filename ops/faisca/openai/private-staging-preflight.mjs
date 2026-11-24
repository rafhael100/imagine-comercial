import { privateStagingGitRevision, privateStagingCleanWorktree } from './private-staging-git-evidence.mjs';
import { createServer } from 'node:net';
import { lstat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFaiscaLocalReservationLedger } from './durable-reservation-ledger.mjs';

export const FAISCA_PRIVATE_STAGING_PREFLIGHT_SCHEMA = 'faisca.private-staging-preflight.v1';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const shaPattern = /^[0-9a-f]{40}$/;
const bearerPattern = /^[A-Za-z0-9_-]{32,128}$/;

function nodeSupported(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
  if (!match) return false;
  const major = Number(match[1]);
  return major > 22 || (major === 22 && Number(match[2]) >= 12);
}

const revision = () => privateStagingGitRevision(root);
const cleanWorktree = () => privateStagingCleanWorktree(root);

async function probePrivatePort(port) {
  // Readiness check only. It binds ONLY loopback briefly and never runs
  // the paid service or exposes a listening socket externally.
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error('private_port_unavailable')));
    server.listen(port, '127.0.0.1', () =>
      server.close(error => error ? reject(new Error('private_port_unavailable')) : resolve()));
  });
}

async function absentReservationLock(directory) {
  try {
    await lstat(join(directory, '.faisca-reservations.lock'));
    return false; // Crash/active reservation: never delete it automatically.
  } catch (error) {
    return error?.code === 'ENOENT';
  }
}

/**
 * Read-only readiness verification for an operator-approved private VPS
 * session. It never connects to OpenAI, starts a server, modifies a ledger,
 * copies a secret or changes any production deployment.
 *
 * test hooks are only for deterministic offline verification; the CLI always
 * uses the real Git, Node, ledger permissions and loopback bind checks.
 */
export async function inspectFaiscaPrivateStaging({
  expectedHead, env = process.env, nodeVersion = process.versions.node,
  gitRevision = revision, isClean = cleanWorktree,
  checkPort = probePrivatePort, port = 4336,
  checkLedger = async directory => {
    const ledger = createFaiscaLocalReservationLedger({
      directory, maxRequests: 100, maxBudgetUsd: 10
    });
    // A valid directory alone does not prove that a previous paid session
    // left a readable ledger or any request/budget capacity.
    // Do not start a session that can pay for Luna but cannot even attempt
    // Terra. These are conservative admission floors, not guaranteed billing
    // limits; each actual dispatch still needs an atomic durable reservation.
    await ledger.ready({
      requireCapacity: true, minimumRequests: 2, minimumBudgetUsd: 0.01
    });
    return absentReservationLock(directory);
  }
} = {}) {
  const steps = [], failed = [];
  async function check(name, condition) {
    let passes = false;
    try { passes = await condition(); } catch { passes = false; }
    steps.push(Object.freeze({ check: name, passed: passes }));
    if (!passes) failed.push(name);
  }
  await check('not_ci_or_github_actions', () => !env.CI && !env.GITHUB_ACTIONS);
  await check('node_22_12_or_newer', () => nodeSupported(nodeVersion));
  await check('independent_operator_sha_pin', () =>
    typeof expectedHead === 'string' && shaPattern.test(expectedHead));
  await check('reviewed_git_head_matches_pin', async () =>
    shaPattern.test(expectedHead ?? '') && await gitRevision() === expectedHead);
  await check('tracked_checkout_is_clean', isClean);
  await check('private_paid_test_opt_in', () =>
    env.IMAGINE_FAISCA_OPENAI_LIVE_TEST === 'YES_PAY_SYNTHETIC_ONLY' &&
    // R302: an invalid explicit mode must not silently start fixed-case review.
    (env.FAISCA_PRIVATE_SYNTHETIC_CONVERSATION === undefined ||
      env.FAISCA_PRIVATE_SYNTHETIC_CONVERSATION === 'YES_SYNTHETIC_ONLY'));
  await check('openai_key_present_only_in_private_environment', () =>
    typeof env.OPENAI_API_KEY === 'string' &&
    /^sk-[A-Za-z0-9_-]{12,}$/.test(env.OPENAI_API_KEY));
  await check('separate_private_review_token', () =>
    typeof env.FAISCA_REVIEW_BEARER_TOKEN === 'string' &&
    bearerPattern.test(env.FAISCA_REVIEW_BEARER_TOKEN) &&
    env.FAISCA_REVIEW_BEARER_TOKEN !== env.OPENAI_API_KEY);
  await check('private_persistent_ledger_ready_without_lock', async () =>
    typeof env.FAISCA_PRIVATE_LEDGER_DIR === 'string' &&
    await checkLedger(env.FAISCA_PRIVATE_LEDGER_DIR) === true);
  await check('private_loopback_port_available', async () =>
    port === 4336 && await checkPort(port) === undefined);

  return Object.freeze({
    schema: FAISCA_PRIVATE_STAGING_PREFLIGHT_SCHEMA,
    status: failed.length ? 'BLOCKED_NO_START' : 'READY_FOR_PRIVATE_OPERATOR_START',
    onlyLocalReview: true,
    publicFaiscaEnabled: false,
    realApiCalled: false,
    productionApproved: false,
    checks: Object.freeze(steps),
    failedChecks: Object.freeze(failed)
  });
}

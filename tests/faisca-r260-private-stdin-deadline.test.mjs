import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL(
  '../scripts/faisca-review-two-listener-boundary.mjs', import.meta.url
));
const HOLD = 'R259: two-listener private boundary unverified (HOLD)\n';
const env = {
  ...process.env, CI: '', GITHUB_ACTIONS: '',
  IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '1',
  IMAGINE_FAISCA_NGINX_IMAGE: 'synthetic-image',
  IMAGINE_FAISCA_STAGING_WORKDIR: '/synthetic/work',
  IMAGINE_FAISCA_STAGING_SITE_DIR: '/synthetic/site',
  IMAGINE_FAISCA_STAGING_HTPASSWD_PATH: '/synthetic/auth'
};

async function incompleteInput(mode) {
  const child = spawn(process.execPath, [cli], {
    env, stdio: ['pipe', 'pipe', 'pipe']
  });
  let stdout = '', stderr = '';
  // A closed child pipe may emit EPIPE while a synthetic drip is in flight.
  child.stdin.on('error', () => {});
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', s => { stdout += s; });
  child.stderr.on('data', s => { stderr += s; });
  child.stdin.write('{"container":[{"private":"SYNTHETIC_SECRET"}]');
  const drip = mode === 'drip'
    ? setInterval(() => {
      if (!child.stdin.destroyed) child.stdin.write(' ');
    }, 180)
    : null;
  const started = Date.now();
  let killed = false;
  const emergency = setTimeout(() => {
    killed = true;
    child.kill('SIGKILL');
  }, 9000);
  const { code, signal } = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (exit, sig) => resolve({ code: exit, signal: sig }));
  }).finally(() => {
    clearTimeout(emergency);
    if (drip) clearInterval(drip);
    child.stdin.destroy();
  });
  return { code, signal, killed, stdout, stderr, elapsed: Date.now() - started };
}

test('R260 partial stdin never leaves private review CLI running forever', async () => {
  const outcome = await incompleteInput('stalled');
  assert.equal(outcome.killed, false);
  assert.equal(outcome.signal, null);
  assert.equal(outcome.code, 2);
  assert.equal(outcome.stdout, '');
  assert.equal(outcome.stderr, HOLD);
  assert.ok(outcome.elapsed < 9000);
});

test('R260 dripping sub-limit stdin cannot extend absolute deadline', async () => {
  const outcome = await incompleteInput('drip');
  assert.equal(outcome.killed, false);
  assert.equal(outcome.signal, null);
  assert.equal(outcome.code, 2);
  assert.equal(outcome.stdout, '');
  assert.equal(outcome.stderr, HOLD);
  assert.ok(outcome.elapsed < 9000);
});

test('R260 refuses CI before reading stdin', async () => {
  const child = spawn(process.execPath, [cli], {
    env: { ...env, CI: 'true' }, stdio: ['pipe', 'pipe', 'pipe']
  });
  let stdout = '', stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', s => { stdout += s; });
  child.stderr.on('data', s => { stderr += s; });
  const result = await new Promise(resolve => child.once('close',
    (code, signal) => resolve({ code, signal })));
  child.stdin.destroy();
  assert.deepEqual(result, { code: 2, signal: null });
  assert.equal(stdout, '');
  assert.equal(stderr, HOLD);
});

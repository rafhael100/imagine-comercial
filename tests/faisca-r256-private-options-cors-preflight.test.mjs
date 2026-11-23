import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reviewFaiscaPrivateNoAuthPreflight as review } from
  '../ops/faisca/staging/review-private-preflight-methods.mjs';

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors ";
const PATHS = [
  '/',
  '/__faisca_preview/journey/',
  '/__faisca_preview/support/index.html',
  '/__faisca_preview/quote-bridge.js?synthetic=1'
];
function headers(path) {
  const frame = path === '/__faisca_preview/journey/';
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': frame ? 'SAMEORIGIN' : 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': CSP + (frame ? "'self'" : "'none'"),
    'Content-Type': 'text/html',
    Server: 'nginx'
  };
}
async function serve(t, mutate = () => {}) {
  const visits = [];
  const server = createServer((req, res) => {
    visits.push({
      method: req.method, url: req.url, headers: req.headers
    });
    const reply = {
      status: 403, headers: headers(req.url), body: '403 Forbidden'
    };
    mutate(reply, req);
    res.writeHead(reply.status, reply.headers);
    res.end(reply.body);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return { port: server.address().port, visits };
}

test('R256 real HTTP: 4 safe synthetic noauth OPTIONS preflights are denied', async t => {
  const { port, visits } = await serve(t);
  const result = await review({ port });
  assert.equal(result.status, 'LOCAL_NOAUTH_CORS_PREFLIGHT_DENIED_REVIEW_ONLY');
  assert.equal(result.blockedPreflightCount, 4);
  assert.equal(result.corsPermissionGranted, false);
  assert.equal(result.noCredentialsSent, true);
  assert.equal(result.authenticatedConversationVerified, false);
  assert.equal(result.dockerProcessOwnershipVerified, false);
  assert.equal(result.providerSpendReconciled, false);
  assert.equal(result.publicReady, false);
  assert.equal(result.publicFaiscaEnabled, false);
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(visits.map(x => x.url), PATHS);
  assert.ok(visits.every(v => v.method === 'OPTIONS' &&
    v.headers.origin === 'https://synthetic-preflight.invalid' &&
    v.headers['access-control-request-method'] === 'POST' &&
    v.headers['access-control-request-headers'] === 'authorization,content-type' &&
    v.headers.authorization === undefined &&
    v.headers.cookie === undefined &&
    v.headers.host === '127.0.0.1:' + port));
  assert.doesNotMatch(JSON.stringify(result), /synthetic-preflight|OPTIONS|journey|quote-bridge/);
});

test('R256 blocks preflight 2xx, redirects, CORS and unsafe response headers', async t => {
  const variants = [
    r => { r.status = 200; },
    r => { r.status = 204; r.body = ''; },
    r => { r.status = 302; r.headers.Location = 'https://synthetic.invalid'; },
    r => { r.status = 405; },
    r => { r.headers['Access-Control-Allow-Origin'] = '*'; },
    r => { r.headers['Access-Control-Allow-Credentials'] = 'true'; },
    r => { r.headers['Set-Cookie'] = 'session=SECRET-FIXTURE'; },
    r => { r.headers.Link = '<https://synthetic.invalid/x>; rel=preload'; },
    r => { r.headers['Content-Security-Policy-Report-Only'] = 'default-src *'; },
    r => { r.headers['Cache-Control'] = 'public, max-age=3600'; },
    r => { r.headers['X-Frame-Options'] = 'SAMEORIGIN'; },
    r => { r.headers['Content-Type'] = 'application/json'; },
    r => { r.headers['Content-Length'] = '50000'; },
    r => { r.body = '<script>SECRET-FIXTURE</script>'; },
    r => { r.body = 'X'.repeat(2049); }
  ];
  for (const mutate of variants) {
    await t.test('preflight mutation is HOLD', async sub => {
      const { port, visits } = await serve(sub, (reply, req) => {
        if (req.url === '/') mutate(reply);
      });
      await assert.rejects(review({ port }),
        /R256: private OPTIONS boundary unverified \(HOLD\)/);
      assert.equal(visits.length, 1, 'No subsequent request after first HOLD');
    });
  }
});

test('R256 accepts protected Basic 401 but not unprotected 401', async t => {
  const { port } = await serve(t, reply => {
    reply.status = 401;
    reply.headers['WWW-Authenticate'] =
      'Basic realm="Imagine Faísca private review"';
  });
  const result = await review({ port });
  assert.equal(result.blockedPreflightCount, 4);
});

test('R256 rejects malformed port before network', async () => {
  for (const port of [0, -1, 65536, '4337', NaN, 1.1, null]) {
    await assert.rejects(review({ port }),
      /R256: private OPTIONS boundary unverified \(HOLD\)/);
  }
});

test('R256 CLI refuses CI, args and missing private opt-in with no request or leak', () => {
  const cli = fileURLToPath(new URL('../scripts/faisca-review-private-options.mjs', import.meta.url));
  const runs = [
    { extra: ['--url', 'https://synthetic.invalid'], env: {} },
    { extra: [], env: { CI: 'true' } },
    { extra: [], env: { GITHUB_ACTIONS: 'true' } },
    { extra: [], env: { IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '' } }
  ];
  for (const r of runs) {
    const child = spawnSync(process.execPath, [cli, ...r.extra], {
      encoding: 'utf8', timeout: 8000,
      env: {
        ...process.env, CI: '', GITHUB_ACTIONS: '',
        IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '1', ...r.env
      }
    });
    assert.equal(child.status, 2);
    assert.equal(child.stdout, '');
    assert.equal(child.stderr,
      'R256: private OPTIONS boundary unverified (HOLD)\n');
    assert.doesNotMatch(child.stderr, /synthetic.invalid/);
  }
});

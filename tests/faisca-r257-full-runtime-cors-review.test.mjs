import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reviewFaiscaPrivateFullRuntimeAndCors as review } from
  '../ops/faisca/staging/review-private-full-runtime-cors.mjs';
import { reviewFaiscaPrivateNoAuthPreflight } from
  '../ops/faisca/staging/review-private-preflight-methods.mjs';

const HOLD = /R257: full private runtime and CORS review unverified \(HOLD\)/;
const full = () => ({
  schema: 'faisca.private-full-runtime-paired-evidence.v1',
  status: 'REPORTED_RUNTIME_POLICY_AND_LOOPBACK_HTTP_REVIEW_ONLY',
  reportedRuntimePolicyFieldsMatch: true,
  reportedImageAndBindingFieldsMatch: true,
  noAuthHttpProbesPassed: 19,
  noCredentialsSent: true,
  operatorEvidenceIndependentlyAuthenticated: false,
  dockerInspectionPerformed: false,
  dockerToHttpProcessOwnershipIndependentlyVerified: false,
  actualNetworkExposureIndependentlyVerified: false,
  authenticatedConversationVerified: false,
  providerSpendReconciled: false,
  publicReady: false,
  deploymentAuthorized: false,
  deploymentPerformed: false,
  publicFaiscaEnabled: false
});
const cors = () => ({
  schema: 'faisca.private-staging-noauth-cors-preflight.v1',
  status: 'LOCAL_NOAUTH_CORS_PREFLIGHT_DENIED_REVIEW_ONLY',
  blockedPreflightCount: 4,
  noCredentialsSent: true,
  corsPermissionGranted: false,
  observedOnLoopbackOnly: true,
  authenticatedConversationVerified: false,
  dockerProcessOwnershipVerified: false,
  providerSpendReconciled: false,
  publicReady: false,
  deploymentAuthorized: false,
  deploymentPerformed: false,
  publicFaiscaEnabled: false
});
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors ";

test('R257 combined report is all-or-nothing, synthetic and explicitly NO-GO', async () => {
  const sequence = [];
  const input = Object.freeze({ synthetic: true });
  const result = await review(input, {
    fullReview: async received => { sequence.push('runtime'); assert.equal(received, input); return full(); },
    corsReview: async opts => { sequence.push('options'); assert.deepEqual(opts, { port: 4337 }); return cors(); }
  });
  assert.deepEqual(sequence, ['runtime', 'options']);
  assert.equal(result.totalNoAuthChecks, 23);
  assert.equal(result.noAuthGetHeadChecks, 19);
  assert.equal(result.noAuthOptionsChecks, 4);
  assert.equal(result.corsPermissionGranted, false);
  assert.equal(result.publicReady, false);
  assert.equal(result.deploymentAuthorized, false);
  assert.equal(result.authenticatedConversationVerified, false);
  assert.equal(result.dockerToHttpProcessOwnershipIndependentlyVerified, false);
  assert.equal(result.providerSpendReconciled, false);
  assert.equal(result.publicFaiscaEnabled, false);
  assert.ok(Object.isFrozen(result));
  assert.doesNotMatch(JSON.stringify(result), /synthetic|token|api_key|model_prompt/i);
});

test('R257 refuses falsified/missing/extra/writable reports and never emits partial positive', async t => {
  const fullChanges = [
    x => { x.noAuthHttpProbesPassed = 18; },
    x => { x.reportedRuntimePolicyFieldsMatch = false; },
    x => { x.dockerToHttpProcessOwnershipIndependentlyVerified = true; },
    x => { x.providerSpendReconciled = true; },
    x => { x.unreviewed = 'unsafe'; },
    x => { delete x.schema; },
    x => { Object.defineProperty(x, 'status', { enumerable: true, get() { throw Error('leak'); } }); },
    x => { Object.defineProperty(x, Symbol('proof'), { value: true }); }
  ];
  for (const mutate of fullChanges) {
    await t.test('runtime report mutation => HOLD before OPTIONS', async () => {
      const record = full(); mutate(record);
      let optionsCalled = false;
      await assert.rejects(review({}, {
        fullReview: async () => record,
        corsReview: async () => { optionsCalled = true; return cors(); }
      }), HOLD);
      assert.equal(optionsCalled, false);
    });
  }
  const corsChanges = [
    x => { x.blockedPreflightCount = 3; },
    x => { x.corsPermissionGranted = true; },
    x => { x.noCredentialsSent = false; },
    x => { x.status = 'success'; },
    x => { x.authenticatedConversationVerified = true; },
    x => { x.unreviewed = true; },
    x => { delete x.schema; },
    x => { Object.defineProperty(x, 'blockedPreflightCount', { enumerable: true, get() { throw Error('leak'); } }); }
  ];
  for (const mutate of corsChanges) {
    await t.test('OPTIONS report mutation => HOLD', async () => {
      const record = cors(); mutate(record);
      await assert.rejects(review({}, {
        fullReview: async () => full(),
        corsReview: async () => record
      }), HOLD);
    });
  }
  await assert.rejects(review({}, {
    fullReview: async () => { throw Error('synthetic-secret'); },
    corsReview: async () => cors()
  }), HOLD);
  await assert.rejects(review({}, {
    fullReview: async () => full(),
    corsReview: async () => { throw Error('synthetic-secret'); }
  }), HOLD);
});

async function fixture(t, badCors = false) {
  const visits = [];
  const server = createServer((req, res) => {
    visits.push({ method: req.method, url: req.url, headers: req.headers });
    const frame = req.url === '/__faisca_preview/journey/';
    const headers = {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': frame ? 'SAMEORIGIN' : 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': CSP + (frame ? "'self'" : "'none'"),
      'Content-Type': 'text/html',
      Server: 'nginx',
      ...(badCors ? { 'Access-Control-Allow-Origin': '*' } : {})
    };
    res.writeHead(403, headers);
    res.end('403 Forbidden');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return { visits, port: server.address().port };
}

test('R257 performs real 4-route OPTIONS over local synthetic HTTP after runtime gate', async t => {
  const { port, visits } = await fixture(t);
  const result = await review({}, {
    fullReview: async () => full(),
    corsReview: ({ port: fixed }) => {
      assert.equal(fixed, 4337);
      return reviewFaiscaPrivateNoAuthPreflight({ port });
    }
  });
  assert.equal(result.totalNoAuthChecks, 23);
  assert.equal(visits.length, 4);
  assert.ok(visits.every(x =>
    x.method === 'OPTIONS' && x.headers.authorization === undefined &&
    x.headers.cookie === undefined && x.headers.origin ===
      'https://synthetic-preflight.invalid'));
});

test('R257 real HTTP CORS leak => HOLD without a positive aggregate', async t => {
  const { port, visits } = await fixture(t, true);
  await assert.rejects(review({}, {
    fullReview: async () => full(),
    corsReview: () => reviewFaiscaPrivateNoAuthPreflight({ port })
  }), HOLD);
  assert.equal(visits.length, 1, 'stop at first leaking response');
});

test('R257 CLI rejects args, CI and missing opt-in before any network or payload echo', () => {
  const cli = fileURLToPath(new URL('../scripts/faisca-review-full-runtime-cors.mjs', import.meta.url));
  const cases = [
    { args: ['--port', '80'], override: {} },
    { args: [], override: { CI: 'true' } },
    { args: [], override: { GITHUB_ACTIONS: 'true' } },
    { args: [], override: { IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '' } },
    { args: [], override: { IMAGINE_FAISCA_NGINX_IMAGE: '' } }
  ];
  for (const entry of cases) {
    const child = spawnSync(process.execPath, [cli, ...entry.args], {
      input: '{"synthetic":"SECRET-FIXTURE"}',
      timeout: 8000, encoding: 'utf8',
      env: {
        ...process.env,
        CI: '', GITHUB_ACTIONS: '',
        IMAGINE_FAISCA_PRIVATE_STAGING_REVIEW: '1',
        IMAGINE_FAISCA_NGINX_IMAGE: 'synthetic-image',
        IMAGINE_FAISCA_STAGING_WORKDIR: '/synthetic/work',
        IMAGINE_FAISCA_STAGING_SITE_DIR: '/synthetic/site',
        IMAGINE_FAISCA_STAGING_HTPASSWD_PATH: '/synthetic/auth',
        ...entry.override
      }
    });
    assert.equal(child.status, 2);
    assert.equal(child.stdout, '');
    assert.equal(child.stderr,
      'R257: full private runtime and CORS review unverified (HOLD)\n');
    assert.doesNotMatch(child.stderr, /SECRET-FIXTURE|synthetic-image/);
  }
});

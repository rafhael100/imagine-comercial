import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { inspectFaiscaPrivateReviewUi } from '../ops/faisca/openai/private-staging-readonly-smoke.mjs';

const token = 'R86_PRIVATE_STATIC_SMOKE_TEST_TOKEN_2026';
function syntheticLab() {
  let calls = 0;
  return {
    answer: async () => {
      calls++;
      throw new Error('Static smoke must never invoke a model.');
    },
    inspect: () => ({ calls, externalModelInvocations: 0 }),
    count: () => calls
  };
}

test('R86 readonly staging smoke checks only the four reviewed private UI assets', async t => {
  const lab = syntheticLab();
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token, port: 0 });
  t.after(() => server.close());
  const paths = [];
  const fetchImpl = async (url, options) => {
    paths.push({ url, method: options.method, hasBearer: !!options.headers,
      redirect: options.redirect, credentials: options.credentials, signal: !!options.signal });
    return fetch(url, options);
  };
  const report = await inspectFaiscaPrivateReviewUi({ origin: server.address, fetchImpl });
  assert.equal(report.status, 'PRIVATE_UI_READONLY_VERIFIED');
  assert.equal(report.requests, 4);
  assert.deepEqual(report.checks.map(x => x.passed), [true,true,true,true]);
  assert.deepEqual(paths.map(x => new URL(x.url).pathname), [
    '/__faisca_openai_private/review',
    '/__faisca_openai_private/review.js',
    '/__faisca_openai_private/review.css',
    '/__faisca_openai_private/mascot.png'
  ]);
  assert.ok(paths.every(item => item.method === 'GET' && !item.hasBearer &&
    item.credentials === 'omit' && item.redirect === 'error' && item.signal));
  assert.equal(report.modelInvocations, 0);
  assert.equal(report.publicReady, false);
  assert.equal(lab.count(), 0);
  assert.equal(server.inspect().requests, 0);
});

test('R86 static smoke rejects external hosts or URL injection before any fetch occurs', async () => {
  let called = 0;
  const fetchImpl = async () => { called++; throw Error('No network'); };
  for (const origin of [
    'https://127.0.0.1:4336','http://localhost:4336',
    'http://127.0.0.2:4336',
    'http://127.0.0.1:4336/path',
    'http://127.0.0.1:4336?key=secret',
    'http://user:pass@127.0.0.1:4336',
    'http://169.254.169.254:80',
    'http://127.0.0.1:65536',
    'http://127.0.0.1:0'
  ]) {
    const report = await inspectFaiscaPrivateReviewUi({origin, fetchImpl});
    assert.equal(report.status, 'BLOCKED_INVALID_PRIVATE_ORIGIN', origin);
    assert.equal(report.requests, 0);
  }
  assert.equal(called, 0);
});

test('R86 static smoke fails closed on missing or weakened headers without making paid calls', async () => {
  let count = 0;
  const fakeFetch = async () => {
    count++;
    return new Response('<html>Faísca review-token review-case</html>', {
      status: 200, headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public,max-age=7200',
        'X-Robots-Tag': 'index,follow',
        'Access-Control-Allow-Origin': '*'
      }
    });
  };
  const result = await inspectFaiscaPrivateReviewUi({
    origin:'http://127.0.0.1:4336',fetchImpl:fakeFetch
  });
  assert.equal(result.status, 'BLOCKED_PRIVATE_UI_NOT_VERIFIED');
  assert.equal(result.requests, 1);
  assert.equal(count, 1);
  assert.equal(result.modelInvocations, 0);
});

test('R86 stale or unavailable loopback endpoint never becomes a release recommendation', async () => {
  const result = await inspectFaiscaPrivateReviewUi({
    origin: 'http://127.0.0.1:4336',
    fetchImpl: async () => { throw new Error('ECONNREFUSED private source'); }
  });
  assert.equal(result.status, 'BLOCKED_PRIVATE_UI_NOT_VERIFIED');
  assert.equal(result.checks[0].passed, false);
  assert.equal(result.publicReady, false);
  assert.doesNotMatch(JSON.stringify(result), /ECONNREFUSED/);
});

test('R86 a hostile oversized static response is rejected without loading it all', async () => {
  const result = await inspectFaiscaPrivateReviewUi({
    origin:'http://127.0.0.1:4336',
    fetchImpl: async () => new Response('X'.repeat(21000), {
      status:200,headers:{
        'Content-Type':'text/html',
        'Cache-Control':'no-store',
        'X-Robots-Tag':'noindex',
        'Content-Security-Policy':"default-src 'none'"
      }
    })
  });
  assert.equal(result.status,'BLOCKED_PRIVATE_UI_NOT_VERIFIED');
  assert.equal(result.requests,1);
});

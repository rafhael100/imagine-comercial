import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFaiscaPrivateReviewUi } from '../ops/faisca/openai/private-staging-readonly-smoke.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'R114_PRIVATE_HEADER_PARITY_SYNTHETIC_TOKEN_123456789';
const lab = {
  answer: async () => { throw new Error('R114 smoke must never call a model'); },
  answerPrivateConversation: async () => {
    throw new Error('R114 smoke must never call a model');
  },
  inspect: () => ({ externalCalls: 0 })
};

for (const privateConversationEnabled of [false, true]) {
  test('R114 real loopback GET assets retain reviewed headers (conversation=' +
    privateConversationEnabled + ')', async t => {
    const server = await startFaiscaOpenAIPrivateReview({
      lab, reviewToken: token, enablePrivateConversation: privateConversationEnabled
    });
    t.after(() => server.close());
    const methods = [];
    const result = await inspectFaiscaPrivateReviewUi({
      origin: server.address, privateConversationEnabled,
      fetchImpl: (url, options) => {
        assert.equal(new URL(url).hostname, '127.0.0.1');
        methods.push(options.method);
        return fetch(url, options);
      }
    });
    assert.equal(result.status, 'PRIVATE_UI_READONLY_VERIFIED');
    assert.deepEqual(methods, ['GET', 'GET', 'GET']);
    assert.equal(result.requests, 3);
    assert.equal(result.modelInvocations, 0);
  });
}

const mutations = [
  ['CSP allows remote scripts', headers => headers.set('Content-Security-Policy',
    "default-src 'none'; script-src * 'unsafe-inline'; connect-src *")],
  ['CSP allows arbitrary connect targets', headers => headers.set('Content-Security-Policy',
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src *; frame-ancestors 'none'")],
  ['CSP enables framing', headers => headers.set('Content-Security-Policy',
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors *")],
  ['framing header missing', headers => headers.delete('X-Frame-Options')],
  ['MIME sniff protection missing', headers => headers.delete('X-Content-Type-Options')],
  ['cache becomes public', headers => headers.set('Cache-Control', 'public, max-age=3600')],
  ['robots protections weakened', headers => headers.set('X-Robots-Tag', 'noindex')],
  ['pragma missing', headers => headers.delete('Pragma')],
  ['referrer policy weakened', headers => headers.set('Referrer-Policy', 'origin')],
  ['asset charset changed', headers => headers.set('Content-Type', 'text/html; charset=latin1')],
  ['credentials CORS header introduced', headers =>
    headers.set('Access-Control-Allow-Credentials', 'true')],
  ['allow-origin introduced', headers =>
    headers.set('Access-Control-Allow-Origin', '*')],
  ['cookie introduced', headers => headers.set('Set-Cookie', 'private_token=synthetic; Path=/')]
];

test('R114 static smoke rejects unsafe header drift even when asset bytes match', async t => {
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());
  for (const [name, mutate] of mutations) {
    let methods = [];
    const result = await inspectFaiscaPrivateReviewUi({
      origin: server.address,
      fetchImpl: async (url, options) => {
        methods.push(options.method);
        const upstream = await fetch(url, options);
        const headers = new Headers(upstream.headers);
        mutate(headers);
        // The HTML/JS/CSS bytes remain exact. Only response policy regresses.
        return new Response(upstream.body, { status: upstream.status, headers });
      }
    });
    assert.equal(result.status, 'BLOCKED_PRIVATE_UI_NOT_VERIFIED', name);
    assert.equal(result.requests, 1, name);
    assert.deepEqual(methods, ['GET'], name);
    assert.equal(result.modelInvocations, 0, name);
  }
});

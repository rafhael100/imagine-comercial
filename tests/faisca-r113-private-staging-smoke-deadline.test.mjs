import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFaiscaPrivateReviewUi } from '../ops/faisca/openai/private-staging-readonly-smoke.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const origin = 'http://127.0.0.1:4336';
const headers = new Headers({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
});

test('R113 private staging smoke times out even if fetch ignores AbortSignal', async () => {
  let requests = 0;
  const start = performance.now();
  const result = await inspectFaiscaPrivateReviewUi({
    origin, timeoutMs: 70,
    fetchImpl: () => { requests++; return new Promise(() => {}); }
  });
  assert.equal(result.status, 'BLOCKED_PRIVATE_UI_NOT_VERIFIED');
  assert.equal(result.requests, 1);
  assert.equal(requests, 1);
  assert.equal(result.modelInvocations, 0);
  assert.ok(performance.now() - start < 2000, 'hard timeout must not await unresolved fetch');
});

test('R113 private staging smoke does not wait for uncooperative stream read or cancel', async () => {
  let read = 0, cancelled = 0;
  const mock = {
    status: 200,
    headers,
    body: {
      getReader() {
        return {
          read() { read++; return new Promise(() => {}); },
          cancel() { cancelled++; return new Promise(() => {}); }
        };
      }
    }
  };
  const start = performance.now();
  const result = await inspectFaiscaPrivateReviewUi({
    origin, timeoutMs: 80, fetchImpl: async () => mock
  });
  assert.equal(result.status, 'BLOCKED_PRIVATE_UI_NOT_VERIFIED');
  assert.equal(result.requests, 1);
  assert.equal(result.modelInvocations, 0);
  assert.equal(read, 1);
  assert.equal(cancelled, 1);
  assert.ok(performance.now() - start < 2000, 'read/cancel must not hang staging readiness');
});

test('R113 refuses invalid private staging smoke deadline configurations', async () => {
  for (const timeoutMs of [0, 49, 3001, NaN, Infinity, '80', null]) {
    const result = await inspectFaiscaPrivateReviewUi({
      origin, timeoutMs,
      fetchImpl: () => { throw new Error('Invalid options must block before network'); }
    });
    assert.equal(result.status, 'BLOCKED_INVALID_PRIVATE_ORIGIN');
    assert.equal(result.requests, 0);
  }
});

test('R113 normal private HTML/JS/CSS loopback smoke still passes without paid calls', async t => {
  let calls = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    reviewToken: 'R113_PRIVATE_STAGING_SMOKE_TEST_TOKEN_123456789',
    lab: {
      answer: async () => { calls++; throw new Error('GET must never invoke API'); },
      inspect: () => ({ syntheticOnly: true, externalCalls: 0 })
    }
  });
  t.after(() => server.close());
  const result = await inspectFaiscaPrivateReviewUi({
    origin: server.address, timeoutMs: 2000
  });
  assert.equal(result.status, 'PRIVATE_UI_READONLY_VERIFIED');
  assert.equal(result.requests, 4);
  assert.equal(result.modelInvocations, 0);
  assert.equal(calls, 0);
});

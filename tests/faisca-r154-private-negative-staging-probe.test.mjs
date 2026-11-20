import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import {
  inspectFaiscaPrivateNegativeConversation,
  FAISCA_PRIVATE_NEGATIVE_PROBE_SCHEMA
} from '../ops/faisca/openai/private-staging-negative-probe.mjs';

const token = 'R154_FAKE_PRIVATE_REVIEW_TOKEN_ONLY_FIXTURE_2026';

function mockLab() {
  let calls = 0;
  return {
    lab: {
      answer: async () => { calls++; throw Error('forbidden dispatch'); },
      answerPrivateConversation: async () => { calls++; throw Error('forbidden dispatch'); },
      inspect: () => ({ calls, publicReady: false, syntheticOnly: true })
    },
    calls: () => calls
  };
}

test('R154 rejects invalid operator configuration before GET or POST', async () => {
  let requests = 0;
  const opts = {
    origin: 'http://127.0.0.1:4336', reviewToken: token,
    enabled: false,
    fetchImpl: async () => { requests++; throw Error('unexpected HTTP'); }
  };
  for (const bad of [
    {}, {enabled: true, origin: 'http://0.0.0.0:4336'},
    {enabled: true, origin: 'http://127.0.0.1:4336/'},
    {enabled: true, origin: 'https://127.0.0.1:4336'},
    {enabled: true, origin: 'http://127.0.0.1:65536'},
    {enabled: true, reviewToken: 'short-token'}
  ]) {
    const result = await inspectFaiscaPrivateNegativeConversation({ ...opts, ...bad });
    assert.equal(result.schema, FAISCA_PRIVATE_NEGATIVE_PROBE_SCHEMA);
    assert.equal(result.status, 'BLOCKED_INVALID_PRIVATE_CONFIGURATION');
    assert.equal(result.apiRequests, 0);
    assert.equal(result.assetRequests, 0);
  }
  assert.equal(requests, 0);
});

test('R154 real loopback server: exact private assets precede one negative POST; no lab dispatch', async t => {
  const mock = mockLab();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: mock.lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  let getCalls = 0, postCalls = 0;
  const fetchImpl = (url, init) => {
    if (init.method === 'GET') getCalls++;
    else if (init.method === 'POST') {
      postCalls++;
      assert.equal(url, server.address + '/__faisca_openai_private/converse');
      assert.equal(init.redirect, 'error');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.cache, 'no-store');
      assert.equal(init.headers.Authorization, 'Bearer ' + token);
      assert.deepEqual(JSON.parse(init.body)[0], true);
    }
    return fetch(url, init);
  };
  const result = await inspectFaiscaPrivateNegativeConversation({
    origin: server.address, reviewToken: token, enabled: true, fetchImpl
  });
  assert.equal(result.status, 'PRIVATE_NEGATIVE_CONVERSATION_VERIFIED');
  assert.equal(result.assetRequests, 4);
  assert.equal(result.apiRequests, 1);
  assert.equal(result.negativeInputRejected, true);
  assert.equal(result.modelCallsProvenZero, false,
    'HTTP proof alone cannot certify provider accounting on an unknown server');
  assert.equal(result.publicReady, false);
  assert.equal(getCalls, 4);
  assert.equal(postCalls, 1);
  assert.equal(mock.calls(), 0, 'a real host rejects opaque R153 marker before model');
  assert.equal(JSON.stringify(result).includes(token), false);
  assert.equal(JSON.stringify(result).includes('cGVzc29h'), false);
});

test('R154 edited private review JS blocks the one negative POST before authorization', async t => {
  const mock = mockLab();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: mock.lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  let postCalls = 0;
  const fetchImpl = async (url, init) => {
    if (init.method === 'POST') postCalls++;
    if (init.method === 'GET' && url.endsWith('/review.js')) {
      return new Response('modified', {
        status: 200,
        headers: { 'Content-Type': 'text/javascript; charset=utf-8' }
      });
    }
    return fetch(url, init);
  };
  const result = await inspectFaiscaPrivateNegativeConversation({
    origin: server.address, reviewToken: token, enabled: true, fetchImpl
  });
  assert.equal(result.status, 'BLOCKED_PRIVATE_UI_NOT_VERIFIED');
  assert.equal(result.apiRequests, 0);
  assert.equal(postCalls, 0);
  assert.equal(mock.calls(), 0);
});

test('R154 invalid private bearer yields no successful proof and no provider dispatch', async t => {
  const mock = mockLab();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: mock.lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const result = await inspectFaiscaPrivateNegativeConversation({
    origin: server.address,
    reviewToken: 'R154_WRONG_PRIVATE_TOKEN_ONLY_FIXTURE_2026',
    enabled: true
  });
  assert.equal(result.status, 'BLOCKED_PRIVATE_NEGATIVE_CONVERSATION');
  assert.equal(result.assetRequests, 4);
  assert.equal(result.apiRequests, 1);
  assert.equal(mock.calls(), 0);
});

test('R154 unreviewed HTTP 200 cannot masquerade as a negative preflight proof', async () => {
  let posts = 0;
  const result = await inspectFaiscaPrivateNegativeConversation({
    enabled: true, reviewToken: token, origin: 'http://127.0.0.1:4336',
    verifyPrivateUi: async () => ({
      status: 'PRIVATE_UI_READONLY_VERIFIED', requests: 4, publicReady: false
    }),
    fetchImpl: async (_url, init) => {
      posts++;
      assert.equal(init.method, 'POST');
      return new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
  });
  assert.equal(posts, 1);
  assert.equal(result.status, 'BLOCKED_PRIVATE_NEGATIVE_CONVERSATION');
  assert.equal(result.negativeInputRejected, false);
  assert.equal(result.apiRequests, 1);
});

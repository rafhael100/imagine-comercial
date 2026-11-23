import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { inspectFaiscaPrivateReviewUi } from '../ops/faisca/openai/private-staging-readonly-smoke.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

test('R298 smoke rejects compressed representations despite identical decoded bytes', async t => {
  let calls = 0;
  const lab = {
    inspect: () => Object.freeze({syntheticOnly: true}),
    answer: async () => {calls++; throw Error('UNEXPECTED_MODEL');}
  };
  const actual = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: 'R298_SYNTHETIC_PRIVATE_REVIEW_TOKEN_ONLY_123456'
  });
  t.after(() => actual.close());
  const route = '/__faisca_openai_private/review';
  const upstream = await fetch(actual.address + route, {redirect: 'error', credentials: 'omit'});
  const bytes = Buffer.from(await upstream.arrayBuffer());
  const headers = Object.fromEntries(upstream.headers);
  for (const name of ['transfer-encoding', 'content-length', 'connection', 'keep-alive']) delete headers[name];
  const zipped = gzipSync(bytes);
  const received = [];
  const server = createServer((req, res) => {
    received.push(req.method);
    res.writeHead(200, {...headers, 'content-encoding': 'gzip', 'content-length': zipped.length});
    res.end(zipped);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const decoded = await fetch(origin + route, {redirect: 'error', credentials: 'omit'});
  assert.deepEqual(Buffer.from(await decoded.arrayBuffer()), bytes);
  assert.equal(decoded.headers.get('content-encoding'), 'gzip');
  const result = await inspectFaiscaPrivateReviewUi({origin});
  assert.equal(result.status, 'BLOCKED_PRIVATE_UI_NOT_VERIFIED');
  assert.equal(result.requests, 1);
  assert.equal(result.publicReady, false);
  assert.equal(result.modelInvocations, 0);
  assert.deepEqual(received, ['GET', 'GET']);
  assert.equal(calls, 0);
  assert.equal((await inspectFaiscaPrivateReviewUi({origin: actual.address})).status, 'PRIVATE_UI_READONLY_VERIFIED');
});

test('R298 smoke rejects mismatched declared length even for identical text', async t => {
  const actual = await startFaiscaOpenAIPrivateReview({
    lab: {inspect: () => Object.freeze({syntheticOnly: true}), answer: async () => {throw Error('UNEXPECTED_MODEL');}},
    reviewToken: 'R298_SYNTHETIC_PRIVATE_REVIEW_TOKEN_ONLY_123456'
  });
  t.after(() => actual.close());
  const fetchImpl = async (url, options) => {
    assert.equal(options.method, 'GET');
    const response = await fetch(url, options);
    const bytes = Buffer.from(await response.arrayBuffer());
    const headers = new Headers(response.headers);
    headers.set('content-length', String(bytes.length + 1));
    return new Response(bytes, {status: 200, headers});
  };
  const result = await inspectFaiscaPrivateReviewUi({origin: actual.address, fetchImpl});
  assert.equal(result.status, 'BLOCKED_PRIVATE_UI_NOT_VERIFIED');
  assert.equal(result.requests, 1);
  assert.equal(result.modelInvocations, 0);
});

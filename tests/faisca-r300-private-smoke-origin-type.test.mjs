import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFaiscaPrivateReviewUi } from '../ops/faisca/openai/private-staging-readonly-smoke.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

test('R300 rejects origin objects before coercion or fetch', async () => {
  let conversions = 0, requests = 0;
  const changing = {
    [Symbol.toPrimitive]() {
      conversions++;
      return conversions === 1 ? 'http://127.0.0.1:4336' : 'https://synthetic.invalid';
    }
  };
  const throwing = {toString() { conversions++; throw Error('UNEXPECTED_COERCION'); }};
  const fetchImpl = async () => {requests++; throw Error('UNEXPECTED_NETWORK');};
  for (const origin of [changing, throwing, new String('http://127.0.0.1:4336'),
    new URL('http://127.0.0.1:4336'), Symbol('synthetic'), null, 4336,
    'http://127.0.0.1:4336\n', 'http://127.0.0.1:4336/', 'http://127.0.0.1:65536']) {
    const result = await inspectFaiscaPrivateReviewUi({origin,fetchImpl});
    assert.equal(result.status,'BLOCKED_INVALID_PRIVATE_ORIGIN');
    assert.equal(result.requests,0);
    assert.equal(result.publicReady,false);
  }
  assert.equal(conversions,0);
  assert.equal(requests,0);
});

test('R300 primitive loopback origin still verifies the four actual assets', async t => {
  let calls = 0;
  const server = await startFaiscaOpenAIPrivateReview({
    lab: {inspect: () => ({syntheticOnly:true}), answer: async () => {calls++; throw Error('UNEXPECTED_MODEL');}},
    reviewToken:'R300_SYNTHETIC_PRIVATE_REVIEW_TOKEN_ONLY_123456'
  });
  t.after(() => server.close());
  const result = await inspectFaiscaPrivateReviewUi({origin:server.address});
  assert.equal(result.status,'PRIVATE_UI_READONLY_VERIFIED');
  assert.equal(result.requests,4);
  assert.equal(result.publicReady,false);
  assert.equal(calls,0);
});

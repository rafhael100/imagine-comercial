import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFaiscaPrivateReviewUi } from '../ops/faisca/openai/private-staging-readonly-smoke.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

test('R314 exact private asset bytes cannot approve ambiguous transfer framing', async t => {
  let modelCalls = 0;
  const actual = await startFaiscaOpenAIPrivateReview({
    lab: {
      inspect: () => Object.freeze({syntheticOnly: true}),
      answer: async () => { modelCalls++; throw Error('UNEXPECTED_MODEL'); }
    },
    reviewToken: 'R314_SYNTHETIC_REVIEW_TOKEN_000000000'
  });
  t.after(() => actual.close());
  for (const variant of ['both', 'gzip', 'multiple', 'empty']) {
    const requests = [];
    const fetchImpl = async (url, options) => {
      requests.push(options.method);
      const response = await fetch(url, options);
      const bytes = Buffer.from(await response.arrayBuffer());
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.delete('transfer-encoding');
      if (variant === 'both') {
        headers.set('transfer-encoding', 'chunked');
        headers.set('content-length', String(bytes.length));
      } else {
        headers.set('transfer-encoding', {gzip:'gzip', multiple:'gzip, chunked', empty:''}[variant]);
      }
      return new Response(bytes, {status: 200, headers});
    };
    const report = await inspectFaiscaPrivateReviewUi({origin: actual.address, fetchImpl});
    assert.equal(report.status, 'BLOCKED_PRIVATE_UI_NOT_VERIFIED', variant);
    assert.equal(report.requests, 1);
    assert.equal(report.publicReady, false);
    assert.equal(report.modelInvocations, 0);
    assert.deepEqual(requests, ['GET']);
  }
  const positive = await inspectFaiscaPrivateReviewUi({origin: actual.address});
  assert.equal(positive.status, 'PRIVATE_UI_READONLY_VERIFIED');
  assert.equal(positive.requests, 4);
  assert.equal(modelCalls, 0);
});

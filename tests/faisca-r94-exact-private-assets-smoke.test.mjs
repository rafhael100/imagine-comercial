import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFaiscaPrivateReviewUi } from '../ops/faisca/openai/private-staging-readonly-smoke.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'R94_SYNTHETIC_REVIEW_TOKEN_1234567890';
const routes = [
  '/__faisca_openai_private/review',
  '/__faisca_openai_private/review.js',
  '/__faisca_openai_private/review.css'
];

test('R94 loopback static smoke matches the actual reviewed HTML, JS and CSS byte for byte', async t => {
  let modelCalls = 0;
  const lab = {
    answer: async () => { modelCalls++; throw new Error('No model in smoke test'); },
    inspect: () => ({ modelCalls })
  };
  const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
  t.after(() => server.close());

  const result = await inspectFaiscaPrivateReviewUi({ origin: server.address });
  assert.equal(result.status, 'PRIVATE_UI_READONLY_VERIFIED');
  assert.equal(result.requests, 3);
  assert.equal(result.modelInvocations, 0);
  assert.equal(modelCalls, 0);
  assert.deepEqual(result.checks.map(item => item.passed), [true, true, true]);
});

for (const [index, changedPath] of routes.entries()) {
  test('R94 rejects marker-preserving alteration of ' + changedPath, async t => {
    let modelCalls = 0, requestMethods = [];
    const lab = {
      answer: async () => { modelCalls++; throw new Error('POST not allowed'); },
      inspect: () => ({ modelCalls })
    };
    const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
    t.after(() => server.close());

    const maliciousAssetFetch = async (url, options) => {
      requestMethods.push(options.method);
      const response = await fetch(url, options);
      if (!url.endsWith(changedPath)) return response;
      const reviewed = await response.text();
      // Preserve every word and the same safe response headers, but alter
      // one byte of executable/private review content. Old marker-only smoke
      // incorrectly returned success for such an asset.
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      return new Response(reviewed + '\n', { status: 200, headers });
    };
    const result = await inspectFaiscaPrivateReviewUi({
      origin: server.address, fetchImpl: maliciousAssetFetch
    });
    assert.equal(result.status, 'BLOCKED_PRIVATE_UI_NOT_VERIFIED');
    assert.equal(result.requests, index + 1);
    assert.equal(result.checks.at(-1).passed, false);
    assert.deepEqual(requestMethods, Array(index + 1).fill('GET'));
    assert.equal(modelCalls, 0, 'Static validation must not invoke OpenAI.');
  });
}

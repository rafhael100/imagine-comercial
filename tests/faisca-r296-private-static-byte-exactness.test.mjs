import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectFaiscaPrivateReviewUi } from '../ops/faisca/openai/private-staging-readonly-smoke.mjs';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const token = 'R296_SYNTHETIC_PRIVATE_REVIEW_TOKEN_ONLY_123456';
const paths = ['/__faisca_openai_private/review', '/__faisca_openai_private/review.js', '/__faisca_openai_private/review.css'];
for (const enabled of [false, true]) {
  test('R296 exact bytes deny BOM for all text assets, conversation=' + enabled, async t => {
    let calls = 0;
    const lab = {
      inspect: () => Object.freeze({syntheticOnly: true}),
      answer: async () => {calls++; throw Error('UNEXPECTED_MODEL');},
      answerPrivateConversation: async () => {calls++; throw Error('UNEXPECTED_MODEL');}
    };
    const server = await startFaiscaOpenAIPrivateReview({lab, reviewToken: token, enablePrivateConversation: enabled});
    t.after(() => server.close());
    const good = await inspectFaiscaPrivateReviewUi({origin: server.address, privateConversationEnabled: enabled});
    assert.equal(good.status, 'PRIVATE_UI_READONLY_VERIFIED');
    for (const [index, changed] of paths.entries()) {
      const seen = [];
      const fetchImpl = async (url, opts) => {
        seen.push(opts.method);
        assert.equal(opts.credentials, 'omit');
        assert.equal(opts.headers, undefined);
        const response = await fetch(url, opts);
        if (!url.endsWith(changed)) return response;
        const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(await response.arrayBuffer())]);
        const headers = new Headers(response.headers);
        headers.set('content-length', String(bytes.length));
        return new Response(bytes, {status: 200, headers});
      };
      const result = await inspectFaiscaPrivateReviewUi({origin: server.address, fetchImpl, privateConversationEnabled: enabled});
      assert.equal(result.status, 'BLOCKED_PRIVATE_UI_NOT_VERIFIED', changed);
      assert.equal(result.requests, index + 1);
      assert.equal(result.checks.at(-1).passed, false);
      assert.deepEqual(seen, Array(index + 1).fill('GET'));
      assert.equal(result.publicReady, false);
      assert.equal(result.modelInvocations, 0);
    }
    assert.equal(calls, 0);
  });
}

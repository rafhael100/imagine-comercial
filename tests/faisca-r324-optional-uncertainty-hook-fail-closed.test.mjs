import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const cases = [
  ['/__faisca_openai_private/respond', { caseId: 'compare' }],
  ['/__faisca_openai_private/converse', [true, 'Vale a pena usar uma landing page para divulgar um evento?']]
];
for (const [firstPath, firstBody] of cases) {
  test('R324 optional uncertainty accessor cannot escape HTTP failure: ' + firstPath, async () => {
    let calls = 0, reads = 0;
    const token = 'R324_SYNTHETIC_REVIEW_TOKEN_000000000';
    const fail = async () => { calls++; throw new Error('SYNTHETIC_PROVIDER_DIAGNOSTIC'); };
    const lab = {
      inspect: () => ({ localDurableReservations: false }),
      answer: fail,
      answerPrivateConversation: fail
    };
    const server = await startFaiscaOpenAIPrivateReview({
      lab, reviewToken: token, enablePrivateConversation: true
    });
    try {
      Object.defineProperty(lab, 'markDeliveryUncertain', {
        get() { reads++; throw new Error('SYNTHETIC_OPTIONAL_HOOK_DIAGNOSTIC'); }
      });
      const post = (path, body) => fetch(server.address + path, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(3000)
      });
      const first = await post(firstPath, firstBody);
      assert.equal(first.status, 503);
      assert.deepEqual(await first.json(), {
        status: 'unavailable', message: 'The private AI review could not confirm a safe response.'
      });
      assert.equal(first.headers.get('cache-control'), 'no-store, max-age=0');
      for (const [path, body] of cases) {
        const response = await post(path, body);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { status: 'unavailable' });
      }
      assert.equal(server.inspect().providerUnavailable, true);
      assert.equal(server.inspect().requests, 1);
      assert.equal(calls, 1);
      assert.equal(reads, 1);
    } finally { await server.close(); }
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

for (const hook of ['assertPrivateHttpDeliverySafe', 'acknowledgeHttpDelivery', 'markDeliveryUncertain']) {
  test('R323 validates the exact pinned durable hook: ' + hook, async () => {
    let calls = 0, uncertain = 0, ack = 0, reads = 0;
    const token = 'R323_SYNTHETIC_REVIEW_TOKEN_000000000';
    const lab = {
      inspect: () => ({ localDurableReservations: true }),
      answer: async () => { calls++; throw new Error('unexpected dispatch'); },
      answerPrivateConversation: async () => { calls++; throw new Error('unexpected conversation'); },
      assertPrivateHttpDeliverySafe: async () => true,
      acknowledgeHttpDelivery: async () => { ack++; return true; },
      markDeliveryUncertain: async () => { uncertain++; return true; }
    };
    const original = lab[hook];
    Object.defineProperty(lab, hook, {
      configurable: true,
      get() { return ++reads === 1 ? original : undefined; }
    });
    const server = await startFaiscaOpenAIPrivateReview({
      lab, reviewToken: token, enablePrivateConversation: true
    });
    try {
      assert.equal(reads, 1, 'validate and pin the same read');
      for (const [path, body] of [
        ['/__faisca_openai_private/converse', [true, 'Vale a pena usar uma landing page para divulgar um evento?']],
        ['/__faisca_openai_private/respond', { caseId: 'compare' }]
      ]) {
        const response = await fetch(server.address + path, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify(body), signal: AbortSignal.timeout(3000)
        });
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { status: 'unavailable' });
      }
      assert.equal(server.inspect().providerUnavailable, true);
      assert.equal(server.inspect().requests, 0);
      assert.equal(reads, 2, 'only one subsequent identity check, then latched');
    } finally { await server.close(); }
    assert.equal(calls, 0);
    assert.equal(ack, 0);
    assert.equal(uncertain, 1);
  });
}

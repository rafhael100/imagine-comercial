import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

for (const hook of ['assertPrivateHttpDeliverySafe', 'acknowledgeHttpDelivery', 'markDeliveryUncertain']) {
  test('R322 failed durable hook lookup latches private dispatch: ' + hook, async () => {
    let calls = 0, uncertain = 0, ack = 0, reads = 0;
    const token = 'R322_SYNTHETIC_REVIEW_TOKEN_000000000';
    const lab = {
      inspect: () => ({ localDurableReservations: true }),
      answer: async () => { calls++; throw new Error('unexpected fixed dispatch'); },
      answerPrivateConversation: async () => { calls++; throw new Error('unexpected conversation dispatch'); },
      assertPrivateHttpDeliverySafe: async () => true,
      acknowledgeHttpDelivery: async () => { ack++; return true; },
      markDeliveryUncertain: async () => { uncertain++; return true; }
    };
    const server = await startFaiscaOpenAIPrivateReview({
      lab, reviewToken: token, enablePrivateConversation: true
    });
    try {
      Object.defineProperty(lab, hook, {
        configurable: true,
        get() { reads++; throw new Error('R322_SYNTHETIC_INTERNAL_DIAGNOSTIC'); }
      });
      const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
      for (const [path, body] of [
        ['/__faisca_openai_private/converse', [true, 'Vale a pena usar uma landing page para divulgar um evento?']],
        ['/__faisca_openai_private/respond', { caseId: 'compare' }]
      ]) {
        const response = await fetch(server.address + path, {
          method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(3000)
        });
        assert.equal(response.status, 503);
        assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
        assert.deepEqual(await response.json(), { status: 'unavailable' });
      }
      assert.equal(server.inspect().providerUnavailable, true);
      assert.equal(server.inspect().requests, 0);
      assert.equal(reads, 1, 'latched request must not access the broken hook again');
      const page = await fetch(server.address + '/__faisca_openai_private/review');
      assert.equal(page.status, 200, 'private static review remains available for operator');
      await page.text();
    } finally { await server.close(); }
    assert.equal(calls, 0);
    assert.equal(ack, 0);
    assert.equal(uncertain, 1, 'only the originally pinned uncertainty hook is invoked');
  });
}

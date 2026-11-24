import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

for (const hook of ['assertPrivateHttpDeliverySafe', 'acknowledgeHttpDelivery', 'markDeliveryUncertain']) {
  test('R317 rejects replaced durable hook before dispatch: ' + hook, async t => {
    let calls = 0, originalUncertain = 0, replacementCalls = 0;
    const token = 'R317_SYNTHETIC_REVIEW_TOKEN_000000000';
    const lab = {
      inspect: () => ({ localDurableReservations: true }),
      answer: async () => { calls++; throw new Error('unexpected provider call'); },
      assertPrivateHttpDeliverySafe: async () => true,
      acknowledgeHttpDelivery: async () => true,
      markDeliveryUncertain: async () => { originalUncertain++; }
    };
    const server = await startFaiscaOpenAIPrivateReview({ lab, reviewToken: token });
    t.after(() => server.close());
    lab[hook] = async () => { replacementCalls++; return true; };
    for (let i = 0; i < 2; i++) {
      const response = await fetch(server.address + '/__faisca_openai_private/respond', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: 'compare' })
      });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).status, 'unavailable');
    }
    assert.equal(server.inspect().providerUnavailable, true);
    assert.equal(server.inspect().requests, 0);
    await server.close();
    assert.equal(calls, 0);
    assert.equal(originalUncertain, 1);
    assert.equal(replacementCalls, 0);
  });
}

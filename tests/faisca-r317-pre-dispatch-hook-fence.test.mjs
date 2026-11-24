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

for (const hook of ['assertPrivateHttpDeliverySafe', 'acknowledgeHttpDelivery', 'markDeliveryUncertain']) {
  test('R320 fictional conversation refuses changed durable hook before either provider path: ' + hook, async t => {
    let fixedCalls = 0, conversationCalls = 0, uncertain = 0, changedCalls = 0, ack = 0;
    const token = 'R320_SYNTHETIC_REVIEW_TOKEN_000000000';
    const lab = {
      inspect: () => ({ localDurableReservations: true }),
      answer: async () => { fixedCalls++; throw new Error('unexpected fixed provider call'); },
      answerPrivateConversation: async () => { conversationCalls++; throw new Error('unexpected conversation provider call'); },
      assertPrivateHttpDeliverySafe: async () => true,
      acknowledgeHttpDelivery: async () => { ack++; return true; },
      markDeliveryUncertain: async () => { uncertain++; return true; }
    };
    const server = await startFaiscaOpenAIPrivateReview({
      lab, reviewToken: token, enablePrivateConversation: true, port: 0
    });
    t.after(() => server.close());
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    const question = 'Vale a pena usar uma landing page para divulgar um evento?';
    const body = JSON.stringify([true, question]);
    const endpoint = server.address + '/__faisca_openai_private/converse';
    lab[hook] = async () => { changedCalls++; return true; };
    const first = await fetch(endpoint, { method: 'POST', headers, body });
    assert.equal(first.status, 503);
    assert.deepEqual(await first.json(), { status: 'unavailable' });
    const fixed = await fetch(server.address + '/__faisca_openai_private/respond', {
      method: 'POST', headers, body: JSON.stringify({ caseId: 'compare' })
    });
    assert.equal(fixed.status, 503);
    assert.deepEqual(await fixed.json(), { status: 'unavailable' });
    assert.equal(server.inspect().providerUnavailable, true);
    assert.equal(server.inspect().requests, 0);
    await server.close();
    assert.equal(fixedCalls, 0);
    assert.equal(conversationCalls, 0);
    assert.equal(uncertain, 1);
    assert.equal(changedCalls, 0);
    assert.equal(ack, 0);
  });
}

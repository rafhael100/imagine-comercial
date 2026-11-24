import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';

const cases = [
  ['/__faisca_openai_private/respond', { caseId: 'compare' }, { status: 'draft_answer' }],
  ['/__faisca_openai_private/converse', [true, 'Vale a pena usar uma landing page para divulgar um evento?'], { status: 'general_answer' }],
  ['/__faisca_openai_private/converse', [true, 'Vale a pena usar uma landing page para divulgar um evento?'], null]
];

for (const [i, [firstPath, firstBody, result]] of cases.entries()) {
  test('R325 durable rejected output cannot admit another dispatch: ' + i, async () => {
    let calls = 0, uncertain = 0, assertions = 0, acknowledgements = 0;
    const token = 'R325_SYNTHETIC_REVIEW_TOKEN_000000000';
    const answer = async () => { calls++; return result; };
    const lab = {
      inspect: () => ({ localDurableReservations: true }),
      answer, answerPrivateConversation: answer,
      assertPrivateHttpDeliverySafe: async () => { assertions++; return true; },
      acknowledgeHttpDelivery: async () => { acknowledgements++; return true; },
      markDeliveryUncertain: async () => { uncertain++; return true; }
    };
    const server = await startFaiscaOpenAIPrivateReview({
      lab, reviewToken: token, enablePrivateConversation: true
    });
    try {
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
      for (const [path, body] of cases) {
        const response = await post(path, body);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { status: 'unavailable' });
      }
      assert.equal(server.inspect().providerUnavailable, true);
      assert.equal(server.inspect().requests, 1);
    } finally { await server.close(); }
    assert.equal(calls, 1);
    assert.equal(uncertain, 1);
    assert.equal(assertions, 0);
    assert.equal(acknowledgements, 0);
  });
}

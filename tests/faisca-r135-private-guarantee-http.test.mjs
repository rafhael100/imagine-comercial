import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

test('R135 fixed and free HTTP egress reject a fabricated guaranteed outcome without echo', async t => {
  const reviewToken = 'S'.repeat(40);
  const approvedSource = getGroundedAnswer('pricing')?.sources[0]?.id;
  assert.ok(approvedSource);
  let current = 'Uma landing page garante vendas para qualquer negócio.', count = 0;
  const lab = {
    answer: async () => {
      count++;
      return { status: 'draft_answer', text: current, sourceIds: [approvedSource],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra'], publicReady: false, operationalEffects: false };
    },
    answerPrivateConversation: async () => {
      count++;
      return { status: 'general_answer', text: current, sourceIds: [],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra'], publicReady: false, operationalEffects: false };
    },
    inspect: () => ({ syntheticOnly: true })
  };
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const cases = [
    ['/__faisca_openai_private/respond', { caseId: 'compare' }],
    ['/__faisca_openai_private/converse', [true, 'Uma landing page ajuda a divulgar eventos?']]
  ];
  for (const [path, body] of cases) {
    const result = await fetch(server.address + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + reviewToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    assert.equal(result.status, 503);
    const text = await result.text();
    assert.match(text, /unavailable/);
    assert.equal(text.includes(current), false);
  }
  current = 'Uma landing page pode apresentar informações gerais de um evento fictício.';
  for (const [path, body] of cases) {
    const result = await fetch(server.address + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + reviewToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    assert.equal(result.status, 200);
    const payload = await result.json();
    assert.equal(payload.answer, current);
    assert.equal(payload.publicReady, false);
  }
  assert.equal(count, 4, 'No retry on unsafe outputs');
});

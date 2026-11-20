import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';

test('R136: both private HTTP paths fail closed on quantitative outcome hallucinations', async t => {
  const approvedSource = getGroundedAnswer('pricing')?.sources[0]?.id;
  assert.ok(approvedSource);
  let text = 'Uma campanha vai gerar 120 leads.', calls = 0;
  const lab = {
    inspect: () => ({ syntheticOnly: true }),
    answer: async () => {
      calls++;
      return {
        status: 'draft_answer', text,
        sourceIds: [approvedSource],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra'],
        publicReady: false, operationalEffects: false
      };
    },
    answerPrivateConversation: async () => {
      calls++;
      return {
        status: 'general_answer', text,
        sourceIds: [],
        modelIds: ['gpt-6-luna', 'gpt-6.1-terra'],
        publicReady: false, operationalEffects: false
      };
    }
  };
  const token = 'B'.repeat(40);
  const server = await startFaiscaOpenAIPrivateReview({
    lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const endpoints = [
    ['/__faisca_openai_private/respond', { caseId: 'compare' }],
    ['/__faisca_openai_private/converse', [true, 'Como funciona uma página para evento fictício?']]
  ];
  for (const claim of [
    'Uma campanha vai gerar 120 leads.',
    'Garantimos vendas para qualquer campanha.',
    'Você terá 50 novos clientes.'
  ]) {
    text = claim;
    for (const [path, body] of endpoints) {
      const response = await fetch(server.address + path, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      assert.equal(response.status, 503, path + ': ' + claim);
      const responseBody = await response.text();
      assert.doesNotMatch(responseBody, /120 leads|garantimos vendas|50 novos clientes/i);
    }
  }
  text = 'Uma landing page pode organizar informações para um evento fictício.';
  for (const [path, body] of endpoints) {
    const response = await fetch(server.address + path, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).answer, text);
  }
  assert.equal(calls, 8, 'No retries or implicit additional requests');
});

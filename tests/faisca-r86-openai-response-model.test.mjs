import test from 'node:test';
import assert from 'node:assert/strict';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';

const key = 'sk-r86-synthetic-fixture-only-1234567';
function apiResponse(model, answer) {
  const data = {
    status: 'completed',
    output: [{ type: 'message', role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(answer) }] }],
    usage: { input_tokens: 30, output_tokens: 12 }
  };
  if (model !== undefined) data.model = model;
  return new Response(JSON.stringify(data), { status: 200,
    headers: { 'Content-Type': 'application/json' } });
}

test('R86 missing, swapped or unrecognized API model identity refuses Luna classification', async () => {
  for (const claimedModel of [
    undefined, null, '', FAISCA_OPENAI_MODELS.answer, 'gpt-6-luna-unaudited'
  ]) {
    let dispatches = 0;
    const lab = createFaiscaOpenAILiveLab({ enabled: true, apiKey: key,
      fetchImpl: async (url, init) => {
        dispatches++;
        assert.equal(url, 'https://api.openai.com/v1/responses');
        assert.equal(JSON.parse(init.body).model, FAISCA_OPENAI_MODELS.classification);
        return apiResponse(claimedModel, { answerId: 'none' });
      }
    });
    await assert.rejects(lab.answer('compare'), error =>
      error.message === 'OpenAI private test unavailable.');
    assert.equal(dispatches, 1, 'No Terra call/retry after false Luna provenance.');
    assert.equal(lab.inspect().calls, 1);
    assert.ok(lab.inspect().reservedUsd > 0, 'Failed request still consumes reservation.');
  }
});

test('R86 Terra identity mismatch fails closed after a genuine mocked Luna selection', async () => {
  let dispatches = 0;
  const lab = createFaiscaOpenAILiveLab({ enabled: true, apiKey: key,
    fetchImpl: async (url, init) => {
      dispatches++;
      const body = JSON.parse(init.body);
      if (dispatches === 1) {
        assert.equal(body.model, FAISCA_OPENAI_MODELS.classification);
        const firstCandidate = JSON.parse(body.input).approvedCandidates[0].id;
        return apiResponse(body.model, { answerId: firstCandidate });
      }
      assert.equal(body.model, FAISCA_OPENAI_MODELS.answer);
      return apiResponse(FAISCA_OPENAI_MODELS.classification, {
        reply: 'A Imagine apresenta serviços digitais, com escopo a confirmar na proposta oficial.'
      });
    }
  });
  await assert.rejects(lab.answer('compare'), error =>
    error.message === 'OpenAI private test unavailable.');
  assert.equal(dispatches, 2);
  assert.equal(lab.inspect().calls, 2);
  assert.ok(lab.inspect().reservedUsd > 0);
  await assert.rejects(lab.answer('process'), /request limit reached/);
  assert.equal(dispatches, 2, 'No hidden retry on mismatch.');
});

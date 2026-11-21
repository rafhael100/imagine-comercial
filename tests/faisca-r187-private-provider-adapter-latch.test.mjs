import test from 'node:test';
import assert from 'node:assert/strict';
import { createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS } from '../ops/faisca/openai/live-lab.mjs';

const key = 'sk-synthetic-r187-never-a-real-secret-123456';
const failure = () => new Response('provider unavailable', {
  status: 503, headers: { 'content-type': 'text/plain' }
});
function reply(model, data) {
  return new Response(JSON.stringify({
    model, status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [
      { type: 'output_text', text: JSON.stringify(data) }
    ] }],
    usage: { input_tokens: 30, output_tokens: 15 }
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}
function lab(fetchImpl, extra = {}) {
  return createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, extendedPrivateSession: true,
    maxRequests: 10, maxBudgetUsd: 1, fetchImpl, ...extra
  });
}

test('R187 a failed Luna transport latches the direct lab, without a second paid dispatch', async () => {
  let calls = 0;
  const client = lab(async () => { calls++; return failure(); });
  await assert.rejects(client.answer('compare'), /OpenAI private test unavailable/);
  assert.equal(client.inspect().calls, 1);
  const reserved = client.inspect().reservedUsd;
  await assert.rejects(client.answer('process'), /OpenAI private test unavailable/);
  assert.equal(calls, 1);
  assert.equal(client.inspect().calls, 1);
  assert.equal(client.inspect().reservedUsd, reserved, 'Never refund or re-reserve on retry');
});

test('R187 an uncertain Terra outcome latches direct fixed-case sessions as well', async () => {
  let calls = 0;
  const client = lab(async (url, init) => {
    calls++;
    const request = JSON.parse(init.body);
    if (request.model === FAISCA_OPENAI_MODELS.classification) {
      const candidates = JSON.parse(request.input).approvedCandidates;
      return reply(FAISCA_OPENAI_MODELS.classification, { answerId: candidates[0].id });
    }
    return failure();
  });
  await assert.rejects(client.answer('compare'), /OpenAI private test unavailable/);
  assert.equal(calls, 2);
  await assert.rejects(client.answer('process'), /OpenAI private test unavailable/);
  assert.equal(calls, 2, 'An uncertain Terra completion cannot be re-dispatched');
  assert.equal(client.inspect().calls, 2);
});

test('R187 direct private conversation also refuses another model call after an uncertain Terra outcome', async () => {
  let calls = 0;
  const client = lab(async (url, init) => {
    calls++;
    const request = JSON.parse(init.body);
    return request.model === FAISCA_OPENAI_MODELS.classification
      ? reply(FAISCA_OPENAI_MODELS.classification, { topic: 'general' })
      : failure();
  }, { enablePrivateConversation: true });
  const question = {
    scope: 'local_operator_lab', attestedSynthetic: true,
    question: 'Como uma landing page ajuda na divulgação de um evento fictício?'
  };
  await assert.rejects(client.answerPrivateConversation(question), /OpenAI private test unavailable/);
  assert.equal(calls, 2);
  await assert.rejects(client.answerPrivateConversation(question), /OpenAI private test unavailable/);
  assert.equal(calls, 2);
});

test('R187 valid unsupported Luna decision is not a transport error and remains reviewable', async () => {
  let calls = 0;
  const client = lab(async () => {
    calls++;
    return reply(FAISCA_OPENAI_MODELS.classification, { answerId: 'none' });
  });
  const first = await client.answer('compare');
  const second = await client.answer('process');
  assert.equal(first.status, 'unsupported');
  assert.equal(second.status, 'unsupported');
  assert.equal(calls, 2);
  assert.equal(client.inspect().calls, 2);
});

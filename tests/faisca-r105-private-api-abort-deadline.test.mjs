import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFaiscaOpenAILiveLab, FAISCA_OPENAI_MODELS
} from '../ops/faisca/openai/live-lab.mjs';

const key = 'sk-R105_SYNTHETIC_FIXTURE_NOT_A_REAL_KEY_123456789';
function lab(fetchImpl) {
  return createFaiscaOpenAILiveLab({
    enabled: true, apiKey: key, fetchImpl,
    extendedPrivateSession: true,
    maxRequests: 2, maxBudgetUsd: 1,
    timeoutMs: 1000
  });
}

test('R105 a transport ignoring AbortSignal cannot hang the paid fetch forever or retry', async () => {
  let requests = 0;
  const client = lab(async (url, options) => {
    requests++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(JSON.parse(options.body).model, FAISCA_OPENAI_MODELS.classification);
    assert.equal(options.signal.aborted, false);
    return new Promise(() => {}); // Malicious/synthetic transport never resolves.
  });
  const started = performance.now();
  await assert.rejects(client.answer('compare'), /OpenAI private test unavailable/);
  assert.ok(performance.now() - started < 5000, 'Independent deadline must settle promptly');
  assert.equal(requests, 1, 'No second model call or hidden retry after uncertain timeout');
  assert.equal(client.inspect().calls, 1, 'Conservative spent-call accounting remains');
  assert.ok(client.inspect().reservedUsd > 0);
});

test('R105 response body stuck after HTTP 200 does not prevent timeout or consume second call', async () => {
  let requests = 0, cancellations = 0;
  const client = lab(async (url, options) => {
    requests++;
    assert.equal(JSON.parse(options.body).model, FAISCA_OPENAI_MODELS.classification);
    const body = new ReadableStream({
      pull() { return new Promise(() => {}); }, // Never produces a byte or closes.
      cancel() { cancellations++; return new Promise(() => {}); } // Never completes.
    });
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });
  const started = performance.now();
  await assert.rejects(client.answer('compare'), /OpenAI private test unavailable/);
  assert.ok(performance.now() - started < 5000, 'Cancel must not hang private timeout path');
  assert.equal(requests, 1);
  assert.equal(client.inspect().calls, 1);
  assert.ok(cancellations <= 1, 'Cancellation is best-effort and never retried');
});

test('R105 ordinary Luna/Terra fixture still completes with bounded JSON bodies', async () => {
  let requests = 0;
  const client = lab(async (url, options) => {
    requests++;
    const { model } = JSON.parse(options.body);
    const body = model === FAISCA_OPENAI_MODELS.classification
      ? { answerId: 'none' }
      : { reply: 'A página reúne as informações em um único local.' };
    return new Response(JSON.stringify({
      status: 'completed', model,
      output: [{ type: 'message', role: 'assistant',
        content: [{ type: 'output_text', text: JSON.stringify(body) }] }],
      usage: { input_tokens: 100, output_tokens: 25 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const result = await client.answer('compare');
  assert.equal(result.status, 'unsupported');
  assert.equal(requests, 1, 'Unsupported grounded classification must not spend on Terra');
  assert.equal(client.inspect().calls, 1);
});

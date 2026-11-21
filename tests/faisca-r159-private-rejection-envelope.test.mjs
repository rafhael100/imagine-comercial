import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import { inspectFaiscaPrivateNegativeConversation } from '../ops/faisca/openai/private-staging-negative-probe.mjs';
import { inspectFaiscaPrivateConversationSequence } from '../ops/faisca/openai/private-staging-sequence.mjs';

const token = 'R159_SYNTHETIC_REVIEW_BEARER_NO_CUSTOMER_DATA_2026';
const safeAnswer = 'Uma landing page pode organizar informacoes gerais de um evento ficticio.';

function fixture() {
  let calls = 0;
  return {
    lab: {
      answer: async () => { throw Error('fixed case is not allowed'); },
      answerPrivateConversation: async () => {
        calls++;
        return {
          status: 'general_answer', text: safeAnswer, sourceIds: [],
          modelIds: ['gpt-6-luna', 'gpt-6.1-terra'],
          publicReady: false, operationalEffects: false
        };
      },
      inspect: () => ({ syntheticOnly: true })
    },
    calls: () => calls
  };
}

function headers() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive'
  };
}

function withoutPrivateMaterial(result) {
  assert.equal(result.publicReady, false);
  assert.equal(result.operationalEffects, false);
  const report = JSON.stringify(result);
  assert.equal(report.includes(token), false);
  assert.equal(report.includes(safeAnswer), false);
  assert.equal(report.includes('cGVzc29h'), false);
}

test('R159 real private loopback rejects a fictitious sensitive question with exact host-owned JSON', async t => {
  const f = fixture();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: f.lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const result = await inspectFaiscaPrivateNegativeConversation({
    origin: server.address, reviewToken: token, enabled: true
  });
  assert.equal(result.status, 'PRIVATE_NEGATIVE_CONVERSATION_VERIFIED');
  assert.equal(result.assetRequests, 4);
  assert.equal(result.apiRequests, 1);
  assert.equal(f.calls(), 0, 'privacy rejection never dispatches the injected model');
  withoutPrivateMaterial(result);
});

test('R159 a generic 400, truncated body, appended data or duplicate keys cannot falsely pass preflight', async t => {
  const f = fixture();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: f.lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const forged = [
    '{"status":"invalid_request"}\n',
    '{"status":"invalid_question"',
    '{"status":"invalid_question","extra":"ok"}\n',
    '{"status":"invalid_request","status":"invalid_question"}\n',
    '{"status":"invalid_question"}\n '
  ];
  for (const body of forged) {
    let posts = 0;
    const fetchImpl = (url, options) => {
      if (options.method !== 'POST') return fetch(url, options);
      posts++;
      return Promise.resolve(new Response(body, { status: 400, headers: headers() }));
    };
    const result = await inspectFaiscaPrivateNegativeConversation({
      origin: server.address, reviewToken: token, enabled: true, fetchImpl
    });
    assert.equal(result.status, 'BLOCKED_PRIVATE_NEGATIVE_CONVERSATION');
    assert.equal(result.assetRequests, 4);
    assert.equal(result.apiRequests, 1);
    assert.equal(posts, 1);
    withoutPrivateMaterial(result);
  }
  assert.equal(f.calls(), 0);
});

test('R159 the negative error code, not HTTP status alone, gates the entire potentially paid sequence', async t => {
  const f = fixture();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: f.lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  let posts = 0;
  const fetchImpl = (url, options) => {
    if (options.method !== 'POST') return fetch(url, options);
    posts++;
    return Promise.resolve(new Response('{"status":"invalid_request"}\n', {
      status: 400, headers: headers()
    }));
  };
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: server.address, reviewToken: token, enabled: true, fetchImpl
  });
  assert.equal(result.status, 'BLOCKED_NEGATIVE_GATE');
  assert.equal(result.positiveEnvelopeAccepted, false);
  assert.equal(result.apiRequests, 1, 'positive POST must never happen');
  assert.equal(posts, 1);
  assert.equal(f.calls(), 0);
  withoutPrivateMaterial(result);
});

test('R159 a stalled 400 body is timed out, never accepted or logged', async t => {
  const f = fixture();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: f.lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  let posts = 0;
  const fetchImpl = (url, options) => {
    if (options.method !== 'POST') return fetch(url, options);
    posts++;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"status":"invalid_question"}'));
        // Deliberately never close: the exact LF and EOF never arrive.
      }
    });
    return Promise.resolve(new Response(stream, { status: 400, headers: headers() }));
  };
  const result = await inspectFaiscaPrivateNegativeConversation({
    origin: server.address, reviewToken: token, enabled: true,
    fetchImpl, timeoutMs: 250
  });
  assert.equal(result.status, 'BLOCKED_PRIVATE_NEGATIVE_CONVERSATION');
  assert.equal(result.apiRequests, 1);
  assert.equal(posts, 1);
  assert.equal(f.calls(), 0);
  withoutPrivateMaterial(result);
});

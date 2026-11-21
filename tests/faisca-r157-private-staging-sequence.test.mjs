import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import {
  FAISCA_PRIVATE_SEQUENCE_SCHEMA,
  inspectFaiscaPrivateConversationSequence
} from '../ops/faisca/openai/private-staging-sequence.mjs';

const token = 'R157_FAKE_REVIEW_BEARER_FOR_SYNTHETIC_TESTS_ONLY';
const safeAnswer = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';

function fixtureLab() {
  let calls = 0;
  return {
    lab: {
      answer: async () => { throw Error('fixed scenario must not run'); },
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

function safeReport(result) {
  assert.equal(result.schema, FAISCA_PRIVATE_SEQUENCE_SCHEMA);
  assert.equal(result.publicReady, false);
  assert.equal(result.operationalEffects, false);
  assert.equal(result.providerTransportVerified, false);
  assert.equal(result.ledgerReconciled, false);
  assert.equal(result.modelCallsProvenExactlyTwoForPositive, false);
  assert.equal(result.modelCallsProvenZeroForNegative, false);
  const json = JSON.stringify(result);
  assert.equal(json.includes(token), false);
  assert.equal(json.includes(safeAnswer), false);
  assert.equal(json.includes('cGVzc29h'), false);
}

test('R157 fails closed without operator gate, loopback or allowed timeouts, before any HTTP', async () => {
  let requests = 0;
  const opts = {
    origin: 'http://127.0.0.1:4336', reviewToken: token,
    fetchImpl: async () => { requests++; throw Error('unexpected network'); }
  };
  for (const bad of [
    {}, { enabled: true, origin: 'http://0.0.0.0:4336' },
    { enabled: true, origin: 'https://127.0.0.1:4336' },
    { enabled: true, origin: 'http://127.0.0.1:4336/' },
    { enabled: true, origin: 'http://127.0.0.1:65536' },
    { enabled: true, reviewToken: 'short' },
    { enabled: true, negativeTimeoutMs: 3001 },
    { enabled: true, positiveTimeoutMs: 35001 }
  ]) {
    const result = await inspectFaiscaPrivateConversationSequence({ ...opts, ...bad });
    assert.equal(result.status, 'BLOCKED_INVALID_PRIVATE_CONFIGURATION');
    assert.equal(result.apiRequests, 0);
    assert.equal(result.assetRequests, 0);
    safeReport(result);
  }
  assert.equal(requests, 0);
});

test('R157 real loopback HTTP runs rejected negative before accepted positive, exact assets twice', async t => {
  const fixture = fixtureLab();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: fixture.lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const sequence = [];
  const fetchImpl = (url, init) => {
    sequence.push(init.method);
    assert.equal(url.startsWith(server.address + '/__faisca_openai_private/'), true);
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.credentials, 'omit');
    if (init.method === 'POST') {
      assert.equal(init.headers.Authorization, 'Bearer ' + token);
      assert.equal(init.referrerPolicy, 'no-referrer');
      assert.equal(JSON.parse(init.body)[0], true);
    }
    return fetch(url, init);
  };
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: server.address, reviewToken: token, enabled: true, fetchImpl
  });
  assert.equal(result.status, 'PRIVATE_SYNTHETIC_SEQUENCE_ENVELOPES_VERIFIED');
  assert.equal(result.negativeInputRejected, true);
  assert.equal(result.positiveEnvelopeAccepted, true);
  assert.equal(result.assetRequests, 8);
  assert.equal(result.apiRequests, 2);
  assert.deepEqual(sequence, [
    'GET', 'GET', 'GET', 'GET', 'POST',
    'GET', 'GET', 'GET', 'GET', 'POST'
  ]);
  assert.equal(fixture.calls(), 1, 'one internal fixture, never any paid model calls');
  assert.equal(server.inspect().requests, 2, 'server counts the rejected POST and the accepted synthetic POST');
  safeReport(result);
});

test('R157 refuses to dispatch either POST when first private asset is adulterated', async t => {
  const fixture = fixtureLab();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: fixture.lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  let posts = 0;
  const fetchImpl = (url, init) => {
    if (init.method === 'POST') posts++;
    if (init.method === 'GET' && url.endsWith('/review.js')) {
      return Promise.resolve(new Response('tampered', {
        status: 200, headers: { 'Content-Type': 'text/javascript; charset=utf-8' }
      }));
    }
    return fetch(url, init);
  };
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: server.address, reviewToken: token, enabled: true, fetchImpl
  });
  assert.equal(result.status, 'BLOCKED_NEGATIVE_GATE');
  assert.equal(result.apiRequests, 0);
  assert.equal(result.positiveEnvelopeAccepted, false);
  assert.equal(posts, 0);
  assert.equal(fixture.calls(), 0);
  safeReport(result);
});

test('R157 fake HTTP 200 on negative preflight cannot authorize positive model dispatch', async t => {
  const fixture = fixtureLab();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: fixture.lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  let posts = 0;
  const fetchImpl = (url, init) => {
    if (init.method === 'POST') {
      posts++;
      return Promise.resolve(new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }));
    }
    return fetch(url, init);
  };
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: server.address, reviewToken: token, enabled: true, fetchImpl
  });
  assert.equal(result.status, 'BLOCKED_NEGATIVE_GATE');
  assert.equal(result.assetRequests, 4);
  assert.equal(result.apiRequests, 1);
  assert.equal(posts, 1, 'positive request must not occur after negative failure');
  assert.equal(fixture.calls(), 0);
  safeReport(result);
});

test('R157 rejects forged positive HTTP 200 with no retries after valid negative preflight', async t => {
  const fixture = fixtureLab();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: fixture.lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  let posts = 0;
  const fetchImpl = (url, init) => {
    if (init.method === 'POST' && ++posts === 2) {
      // A valid status and security headers cannot make this forged public
      // readiness field acceptable, even after a successful negative gate.
      return Promise.resolve(new Response(JSON.stringify({
        schema: 'faisca.openai-private-conversation-response.v1',
        status: 'general_answer', answer: safeAnswer, sources: [],
        models: ['gpt-6-luna', 'gpt-6.1-terra'],
        sourceRecipeBound: false, requiresEditorialReview: true,
        publicReady: true, operationalEffects: false
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0',
          'X-Content-Type-Options': 'nosniff',
          'X-Robots-Tag': 'noindex, nofollow, noarchive'
        }
      }));
    }
    return fetch(url, init);
  };
  const result = await inspectFaiscaPrivateConversationSequence({
    origin: server.address, reviewToken: token, enabled: true, fetchImpl
  });
  assert.equal(result.status, 'BLOCKED_POSITIVE_GATE');
  assert.equal(result.apiRequests, 2);
  assert.equal(result.assetRequests, 8);
  assert.equal(result.negativeInputRejected, true);
  assert.equal(result.positiveEnvelopeAccepted, false);
  assert.equal(posts, 2);
  assert.equal(fixture.calls(), 0);
  safeReport(result);
});

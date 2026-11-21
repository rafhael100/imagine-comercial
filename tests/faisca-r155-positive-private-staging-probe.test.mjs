import test from 'node:test';
import assert from 'node:assert/strict';
import { startFaiscaOpenAIPrivateReview } from '../ops/faisca/openai/private-review-http.mjs';
import {
  FAISCA_PRIVATE_POSITIVE_PROBE_SCHEMA,
  inspectFaiscaPrivatePositiveConversation
} from '../ops/faisca/openai/private-staging-positive-probe.mjs';

const token = 'R155_FAKE_PRIVATE_REVIEW_TOKEN_ONLY_FIXTURE_2026';
const answer = 'Uma landing page pode apresentar a programação de um evento e orientar as pessoas sobre como participar.';

function fixtureLab() {
  let calls = 0;
  return {
    lab: {
      answer: async () => { throw Error('fixed answer not in test'); },
      answerPrivateConversation: async () => {
        calls++;
        return {
          status: 'general_answer', text: answer,
          sourceIds: [], modelIds: ['gpt-6-luna', 'gpt-6.1-terra'],
          publicReady: false, operationalEffects: false
        };
      },
      inspect: () => ({ syntheticOnly: true })
    },
    calls: () => calls
  };
}

test('R155 refuses unsafe configuration before any network request', async () => {
  let calls = 0;
  const initial = {
    origin: 'http://127.0.0.1:4336', reviewToken: token,
    fetchImpl: async () => { calls++; throw Error('must not fetch'); }
  };
  for (const variant of [
    {}, { enabled: true, origin: 'http://0.0.0.0:4336' },
    { enabled: true, origin: 'http://127.0.0.1:4336/' },
    { enabled: true, origin: 'https://127.0.0.1:4336' },
    { enabled: true, origin: 'http://127.0.0.1:65536' },
    { enabled: true, reviewToken: 'not-a-token' },
    { enabled: true, timeoutMs: 36000 }
  ]) {
    const result = await inspectFaiscaPrivatePositiveConversation({ ...initial, ...variant });
    assert.equal(result.schema, FAISCA_PRIVATE_POSITIVE_PROBE_SCHEMA);
    assert.equal(result.status, 'BLOCKED_INVALID_PRIVATE_CONFIGURATION');
    assert.equal(result.apiRequests, 0);
    assert.equal(result.assetRequests, 0);
    assert.equal(result.publicReady, false);
  }
  assert.equal(calls, 0);
});

test('R155 real loopback HTTP: exact private UI then one positive synthetic envelope', async t => {
  const fixture = fixtureLab();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: fixture.lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  let gets = 0, posts = 0;
  const fetchImpl = (url, init) => {
    if (init.method === 'GET') gets++;
    if (init.method === 'POST') {
      posts++;
      assert.equal(url, server.address + '/__faisca_openai_private/converse');
      assert.equal(init.redirect, 'error');
      assert.equal(init.cache, 'no-store');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.referrerPolicy, 'no-referrer');
      assert.equal(init.headers.Authorization, 'Bearer ' + token);
      assert.deepEqual(JSON.parse(init.body), [
        true, 'Vale a pena usar uma landing page para divulgar um evento?'
      ]);
    }
    return fetch(url, init);
  };
  const result = await inspectFaiscaPrivatePositiveConversation({
    origin: server.address, reviewToken: token, enabled: true, fetchImpl
  });
  assert.equal(result.status, 'PRIVATE_POSITIVE_ENVELOPE_VERIFIED');
  assert.equal(result.assetRequests, 4);
  assert.equal(result.apiRequests, 1);
  assert.equal(result.positiveEnvelopeAccepted, true);
  assert.equal(result.modelCallsProvenExactlyTwo, false);
  assert.equal(result.providerTransportVerified, false);
  assert.equal(result.publicReady, false);
  assert.equal(gets, 4);
  assert.equal(posts, 1);
  assert.equal(fixture.calls(), 1, 'only one synthetic fixture dispatch, zero external model calls');
  assert.equal(server.inspect().requests, 1);
  assert.equal(JSON.stringify(result).includes(answer), false);
  assert.equal(JSON.stringify(result).includes(token), false);
});

test('R155 modified private JS prevents the positive POST even when the server would answer', async t => {
  const fixture = fixtureLab();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: fixture.lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  let posts = 0;
  const fetchImpl = async (url, init) => {
    if (init.method === 'POST') posts++;
    if (init.method === 'GET' && url.endsWith('/review.js')) {
      return new Response('tampered', {
        status: 200, headers: { 'Content-Type': 'text/javascript; charset=utf-8' }
      });
    }
    return fetch(url, init);
  };
  const result = await inspectFaiscaPrivatePositiveConversation({
    origin: server.address, reviewToken: token, enabled: true, fetchImpl
  });
  assert.equal(result.status, 'BLOCKED_PRIVATE_UI_NOT_VERIFIED');
  assert.equal(result.apiRequests, 0);
  assert.equal(posts, 0);
  assert.equal(fixture.calls(), 0);
});

test('R155 incorrect bearer fails closed without a second dispatch or any response echo', async t => {
  const fixture = fixtureLab();
  const server = await startFaiscaOpenAIPrivateReview({
    lab: fixture.lab, reviewToken: token, enablePrivateConversation: true
  });
  t.after(() => server.close());
  const result = await inspectFaiscaPrivatePositiveConversation({
    origin: server.address,
    reviewToken: 'R155_WRONG_REVIEW_TOKEN_ONLY_FIXTURE_2026', enabled: true
  });
  assert.equal(result.status, 'BLOCKED_PRIVATE_POSITIVE_CONVERSATION');
  assert.equal(result.apiRequests, 1);
  assert.equal(fixture.calls(), 0);
});

test('R155 rejects forged HTTP 200, unsupported content, malformed provenance and oversized body', async () => {
  const good = {
    schema: 'faisca.openai-private-conversation-response.v1',
    status: 'general_answer', answer,
    sources: [], models: ['gpt-6-luna', 'gpt-6.1-terra'],
    sourceRecipeBound: false, requiresEditorialReview: true,
    publicReady: false, operationalEffects: false
  };
  const spoofed = [
    { ...good, models: ['gpt-6-luna'] },
    { ...good, answer: 'A Imagine já publicou uma landing page e garante novos clientes.' },
    { ...good, answer: 'Entre em contato com pessoa@example.invalid para publicar a página.' },
    { ...good, sources: ['unreviewed-source'] },
    { ...good, publicReady: true },
    { ...good, requiresEditorialReview: false },
    { ...good, status: 'needs_confirmation' },
    { ...good, extras: true },
    { ...good, answer: 'X'.repeat(4200) }
  ];
  for (const body of spoofed) {
    let posts = 0;
    const result = await inspectFaiscaPrivatePositiveConversation({
      enabled: true, origin: 'http://127.0.0.1:4336',
      reviewToken: token,
      verifyPrivateUi: async () => ({
        status: 'PRIVATE_UI_READONLY_VERIFIED', requests: 4,
        publicReady: false, checks: Array.from({ length: 4 }, () => ({ passed: true }))
      }),
      fetchImpl: async (_url, init) => {
        posts++;
        assert.equal(init.method, 'POST');
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store, max-age=0',
            'X-Content-Type-Options': 'nosniff',
            'X-Robots-Tag': 'noindex, nofollow, noarchive'
          }
        });
      }
    });
    assert.equal(result.status, 'BLOCKED_PRIVATE_POSITIVE_CONVERSATION');
    assert.equal(result.apiRequests, 1);
    assert.equal(posts, 1);
    assert.equal(result.providerTransportVerified, false);
    assert.equal(JSON.stringify(result).includes('example.invalid'), false);
  }
});

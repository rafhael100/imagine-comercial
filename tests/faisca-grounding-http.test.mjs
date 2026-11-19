import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../ops/faisca/core.mjs';
import { groundedRespond } from '../ops/faisca/grounding/guide.mjs';
import { createConversationResponse, validateConversationResponse } from '../ops/faisca/conversation-contract.mjs';
import { createConversationRuntime, createConversationOutcome } from '../ops/faisca/conversation-runtime.mjs';
import { createHttpResult, HTTP_CONTEXT, HTTP_SESSION_SCHEMA } from '../ops/faisca/http-contract.mjs';
import { createHttpConversationClient } from '../ops/faisca/lab/http-client.mjs';
import { validateGroundedHttpResult } from '../ops/faisca/grounding/http-policy.mjs';

const request = (input = { type: 'action', id: 'goal_presence' }) => ({ schema: 'faisca.conversation.v1',
  conversationId: 'r06_conversation_01', messageId: 'r06_message_0001', locale: 'pt-BR', input });
const answer = input => groundedRespond(createSession(), input).reply;
const result = (req, reply) => createHttpResult(req,
  createConversationOutcome('answered', { reply, accepted: true, delivery: 'simulated' }));

test('R06 keeps exact per-passage versions and rejects an otherwise valid different-topic HTTP answer', () => {
  const req = request();
  const prepared = answer(req.input);
  const valid = result(req, prepared);
  assert.equal(validateGroundedHttpResult(valid, req, prepared), true);
  assert.equal(validateConversationResponse(valid.response, req).sources[0].version, 'faisca-grounding-1');
  const wrongTopic = result(req, answer({ type: 'action', id: 'channel_meta' }));
  assert.ok(validateConversationResponse(wrongTopic.response, req), 'It is a genuine admissible passage, not just malformed data.');
  assert.equal(validateGroundedHttpResult(wrongTopic, req, prepared), false);
  const falseClaim = structuredClone(valid);
  falseClaim.response.text += '\nA entrega está garantida para amanhã.';
  assert.equal(validateGroundedHttpResult(falseClaim, req, prepared), false);
  const wrongVersion = structuredClone(valid.response);
  wrongVersion.sources[0].version = 'faisca-editorial-2';
  assert.equal(validateConversationResponse(wrongVersion, req), null);
});

test('R06 checks unknown/fallback wording and citations against the same prepared turn', () => {
  const req = request();
  const prepared = answer(req.input);
  for (const status of ['unknown', 'unavailable', 'provider_limit', 'invalid_response']) {
    const value = createHttpResult(req, createConversationOutcome(status, { reply: prepared, accepted: true,
      delivery: status === 'unknown' ? 'unknown' : 'guided_fallback',
      reason: status === 'unknown' ? 'timeout_after_dispatch' : status }));
    assert.equal(validateGroundedHttpResult(value, req, prepared), true);
    const corrupt = structuredClone(value);
    corrupt.response.text = 'Preço confirmado sem proposta.';
    assert.equal(validateGroundedHttpResult(corrupt, req, prepared), false);
  }
});

test('R06 unsupported, ambiguous and navigation turns never dispatch the provider', async () => {
  let calls = 0;
  const runtime = createConversationRuntime({ prepareTurn: groundedRespond,
    provider: { kind: 'simulated', respond() { calls++; throw new Error('Local guidance must not dispatch.'); } } });
  try {
    const inputs = [
      { type: 'text', text: 'O site inclui e-mail?' },
      { type: 'text', text: 'Quero apresentar minha empresa e captar contatos para uma campanha.' },
      { type: 'action', id: 'sell' }
    ];
    for (let index = 0; index < inputs.length; index++) {
      const req = { ...request(inputs[index]), messageId: 'r06_local_' + index };
      const outcome = await runtime.send(req);
      assert.equal(outcome.status, 'answered');
      assert.equal(outcome.delivery, 'guided_fallback');
      assert.match(outcome.reason, /^grounding_(?:unsupported|ambiguous|navigation)$/);
      assert.deepEqual(outcome.reply.sources, []);
      assert.equal(validateGroundedHttpResult(createHttpResult(req, outcome), req,
        groundedRespond(createSession(), inputs[index]).reply), true);
    }
    assert.equal(calls, 0);
    assert.equal(runtime.inspect().dispatched, 0);
  } finally { runtime.destroy(); }
});

test('R06 HTTP client keeps a legitimate wrong-topic reply uncertain and reconciles the original once', async () => {
  const states = [], paths = [];
  let savedRequest;
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  const client = createHttpConversationClient({ origin: 'http://127.0.0.1:4332',
    prepareTurn: groundedRespond, validatePreparedResult: validateGroundedHttpResult,
    onState(value) { states.push(value.status); },
    async fetchImpl(url, options) {
      const path = new URL(url).pathname;
      paths.push(path);
      if (options.method === 'DELETE') return new Response(null, { status: 204 });
      if (path.endsWith('/sessions')) return json({ schema: HTTP_SESSION_SCHEMA,
        conversationId: 'a'.repeat(32), token: 'b'.repeat(64), expiresInMs: 300000, context: HTTP_CONTEXT }, 201);
      const req = JSON.parse(options.body);
      if (path.endsWith('/messages')) {
        savedRequest = req;
        return json(result(req, answer({ type: 'action', id: 'channel_meta' })));
      }
      assert.deepEqual(req, savedRequest, 'Consultation must bind to the same original request.');
      return json(result(req, answer(req.input)));
    } });
  try {
    const pending = client.replyAdapter.send({ type: 'action', id: 'goal_presence' });
    const deadline = Date.now() + 1000;
    while (!states.includes('transport_unknown') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(states.includes('transport_unknown'));
    const reconciled = await client.reconcile();
    assert.equal(reconciled.status, 'answered');
    assert.equal((await pending).reply.text, answer(savedRequest.input).text);
    assert.equal(paths.filter(path => path.endsWith('/messages')).length, 1);
    assert.equal(paths.filter(path => path.endsWith('/reconcile')).length, 1);
  } finally { client.replyAdapter.destroy(); }
});

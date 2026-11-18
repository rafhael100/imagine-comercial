import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond } from '../ops/faisca/core.mjs';
import { KNOWLEDGE } from '../ops/faisca/knowledge.mjs';
import { CONVERSATION_SCHEMA, RESPONSE_SCHEMA, validateConversationRequest,
  conversationFingerprint, createConversationResponse, validateConversationResponse,
  conversationResponseToReply } from '../ops/faisca/conversation-contract.mjs';

const request = (input = { type: 'text', text: 'Preciso de um site' }) => ({ schema: CONVERSATION_SCHEMA,
  conversationId: 'conversation_synthetic_01', messageId: 'message_synthetic_0001', locale: 'pt-BR', input });
const response = req => createConversationResponse(req, respond(createSession(), req.input).reply);

test('closed request detaches data and canonical fingerprint survives JSON key order', async () => {
  const original = request();
  const detached = validateConversationRequest(original);
  const reordered = { input: { text: original.input.text, type: 'text' }, locale: 'pt-BR',
    messageId: original.messageId, conversationId: original.conversationId, schema: CONVERSATION_SCHEMA };
  assert.equal(await conversationFingerprint(original), await conversationFingerprint(reordered));
  assert.match(await conversationFingerprint(original), /^[a-f0-9]{64}$/);
  original.input.text = 'different';
  assert.equal(detached.input.text, 'Preciso de um site');
  assert.ok(Object.isFrozen(detached.input));
  assert.notEqual(await conversationFingerprint(original), await conversationFingerprint(detached));
});

test('visitor request cannot select authority, provider, sources, tools or pricing', () => {
  for (const key of ['tenant_id', 'role', 'permission', 'tool', 'price', 'provider', 'knowledgeVersion', 'session']) {
    assert.equal(validateConversationRequest({ ...request(), [key]: 'forged' }), null, key);
  }
  assert.equal(validateConversationRequest(request({ type: 'action', id: 'create_lead' })), null);
  assert.equal(validateConversationRequest(request({ type: 'text', text: 'hello', role: 'admin' })), null);
  for (const changes of [{ schema: 'future' }, { locale: 'en' }, { conversationId: '../../path' }, { messageId: 'short' }]) {
    assert.equal(validateConversationRequest({ ...request(), ...changes }), null);
  }
});

test('request rejects accessors, symbols, inherited authority and revoked proxies without reading accessors', () => {
  let accessed = 0;
  const getter = request();
  Object.defineProperty(getter, 'input', { get() { accessed++; return { type: 'text', text: 'x' }; } });
  assert.equal(validateConversationRequest(getter), null);
  const input = { type: 'text' };
  Object.defineProperty(input, 'text', { enumerable: true, get() { accessed++; return 'x'; } });
  assert.equal(validateConversationRequest(request(input)), null);
  assert.equal(accessed, 0);
  const symbol = request(); symbol[Symbol('authority')] = true;
  assert.equal(validateConversationRequest(symbol), null);
  assert.equal(validateConversationRequest(Object.assign(Object.create({ role: 'admin' }), request())), null);
  const proxy = Proxy.revocable({}, {}); proxy.revoke();
  assert.equal(validateConversationRequest(proxy.proxy), null);
});

test('request limits Unicode characters and rejects empty or ambiguous discriminated inputs', () => {
  assert.ok(validateConversationRequest(request({ type: 'text', text: '😀'.repeat(800) })));
  assert.equal(validateConversationRequest(request({ type: 'text', text: '😀'.repeat(801) })), null);
  assert.equal(validateConversationRequest(request({ type: 'text', text: '   ' })), null);
  assert.equal(validateConversationRequest(request({ type: 'text', text: 'hello', id: 'sell' })), null);
  assert.ok(validateConversationRequest(request({ type: 'action', id: 'sell' })));
});

test('response resolves labels from trusted knowledge instead of provider text', () => {
  const req = request({ type: 'action', id: 'sell' });
  const wire = response(req);
  assert.equal(wire.schema, RESPONSE_SCHEMA);
  assert.equal(wire.knowledgeVersion, KNOWLEDGE.version);
  const valid = validateConversationResponse(wire, req);
  assert.ok(valid);
  const reply = conversationResponseToReply(valid);
  assert.equal(reply.actions[0].label, 'Apresentar minha empresa');
  assert.equal(reply.sources[0].title, KNOWLEDGE.sources.faq.title);
  assert.equal(Object.hasOwn(wire.actions[0], 'label'), false);
  assert.equal(Object.hasOwn(wire.sources[0], 'title'), false);
});

test('response rejects cross-message/cross-conversation, stale knowledge and source versions', () => {
  const req = request(); const wire = response(req);
  for (const changes of [{ conversationId: 'other_conversation' }, { messageId: 'other_message' },
    { locale: 'es' }, { schema: CONVERSATION_SCHEMA }, { knowledgeVersion: 'old' },
    { sources: [{ ...wire.sources[0], version: 'old' }] },
    { sources: [{ id: 'unknown-source', version: KNOWLEDGE.version }] }]) {
    assert.equal(validateConversationResponse({ ...wire, ...changes }, req), null);
  }
});

test('response refuses executable content and any attempt to turn a reply into an effect', () => {
  const req = request(); const wire = response(req);
  for (const text of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', 'x\u0000y', ' ']) {
    assert.equal(validateConversationResponse({ ...wire, text }, req), null);
  }
  assert.equal(validateConversationResponse({ ...wire, tool_calls: [{ type: 'buy' }] }, req), null);
  assert.equal(validateConversationResponse({ ...wire, actions: [{ id: 'create_lead' }] }, req), null);
  assert.equal(validateConversationResponse({ ...wire, actions: [{ id: 'sell', url: 'https://invalid.example' }] }, req), null);
  assert.equal(validateConversationResponse({ ...wire, sources: [{ ...wire.sources[0], title: 'forged' }] }, req), null);
});

test('response lists reject holes, accessors, duplicates and non-data properties', () => {
  const req = request(); const wire = response(req);
  let accessed = 0;
  const getter = [{ id: 'sell' }];
  Object.defineProperty(getter, '0', { get() { accessed++; return { id: 'sell' }; } });
  const hole = new Array(1);
  const extra = [{ id: 'sell' }]; extra.authority = true;
  for (const actions of [getter, hole, extra, [{ id: 'sell' }, { id: 'sell' }]]) {
    assert.equal(validateConversationResponse({ ...wire, actions }, req), null);
  }
  assert.equal(validateConversationResponse({ ...wire, sources: [wire.sources[0], wire.sources[0]] }, req), null);
  assert.equal(accessed, 0);
});

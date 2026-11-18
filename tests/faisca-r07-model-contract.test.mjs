import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareLocalModelRequest, localModelFixture, verifyLocalModelOutput,
  resolveLocalModelOutput, MODEL_REQUEST_SCHEMA, MODEL_RESPONSE_SCHEMA } from '../ops/faisca/journey/model-contract.mjs';
import { getGroundedAnswer } from '../ops/faisca/grounding/guide.mjs';
import { CATALOG_SHA256 } from '../ops/faisca/grounding/catalog.mjs';

const prepare = (answerId = 'goal_presence') => prepareLocalModelRequest({
  conversationId: 'synthetic-conversation-001', messageId: 'synthetic-message-001', answerId, locale: 'pt-BR'
});

test('R07 model request fixes corpus, limits and opaque IDs without user text, URLs or tools', () => {
  const request = prepare();
  assert.equal(request.schema, MODEL_REQUEST_SCHEMA);
  assert.equal(request.catalogDigest, CATALOG_SHA256);
  assert.equal(request.allowedPassages.length, 2);
  assert.ok(request.allowedPassages.every(p => p.trust === 'UNTRUSTED_DATA' && p.text.length > 0));
  assert.deepEqual(Object.keys(request.limits).sort(), ['maxActions', 'maxAnswerCharacters', 'maxPassages', 'timeoutMs']);
  assert.equal(JSON.stringify(request).includes('apiKey'), false);
  assert.equal(JSON.stringify(request).includes('bearer'), false);
  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.allowedPassages), true);
});

test('R07 model local success is exact to the editorial R06 recipe, never free-form generated prose', () => {
  for (const answerId of ['goal_presence', 'goal_campaign', 'compare_sites', 'channel_google', 'pricing', 'scope', 'process']) {
    const request = prepare(answerId);
    const fixture = localModelFixture(request);
    assert.equal(fixture.schema, MODEL_RESPONSE_SCHEMA);
    const verified = verifyLocalModelOutput(request, fixture);
    assert.equal(verified.accepted, true, answerId);
    assert.equal(verified.text, getGroundedAnswer(answerId).text, answerId);
    assert.equal(verified.provenance, 'r06_verified_editorial');
  }
});

test('R07 model rejects unsupported, invalid source, invented pricing and prompt-injection prose', () => {
  const request = prepare();
  for (const scenario of ['wrong_topic', 'invented_price', 'prompt_injection', 'unsupported', 'extra_field', 'extra_action', 'stale_version']) {
    const output = localModelFixture(request, scenario);
    const verified = verifyLocalModelOutput(request, output);
    assert.equal(verified.accepted, false, scenario);
    const fallback = resolveLocalModelOutput(request, output);
    assert.equal(fallback.provenance, 'local_fallback', scenario);
    assert.deepEqual(fallback.sources, [], scenario);
    assert.doesNotMatch(fallback.text, /99|garantido|ignore as regras/i);
  }
});

test('R07 model preserves correlation and rejects session spoofing even with genuine passages', () => {
  const one = prepare(), other = prepareLocalModelRequest({
    conversationId: 'synthetic-conversation-002', messageId: 'synthetic-message-002',
    answerId: 'goal_presence', locale: 'pt-BR'
  });
  assert.notEqual(one.invocationId, other.invocationId);
  const valid = localModelFixture(one);
  assert.equal(verifyLocalModelOutput(other, valid).accepted, false);
  assert.equal(verifyLocalModelOutput({ ...one }, valid).accepted, false);
  assert.equal(verifyLocalModelOutput(one, { ...valid, messageId: other.messageId }).accepted, false);
});

test('R07 model refuses unreviewed recipe, locale or user-selected arbitrary source', () => {
  assert.equal(prepareLocalModelRequest({ conversationId: 'c', messageId: 'm', answerId: 'missing', locale: 'pt-BR' }), null);
  assert.equal(prepareLocalModelRequest({ conversationId: 'c', messageId: 'm', answerId: 'goal_presence', locale: 'en-US' }), null);
  assert.equal(prepareLocalModelRequest({ conversationId: 'c', messageId: 'm', answerId: '../../crm', locale: 'pt-BR' }), null);
  assert.equal(localModelFixture({ answerId: 'goal_presence' }).error, 'invalid_request');
});

test('R07 model rejects an accessor, extra own property, executable field or mutated action list', () => {
  const request = prepare();
  const original = localModelFixture(request);
  let reads = 0;
  const evil = { ...original };
  Object.defineProperty(evil, 'answerText', { enumerable: true, get() { reads++; return original.answerText; } });
  assert.equal(verifyLocalModelOutput(request, evil).accepted, false);
  assert.equal(reads, 0);
  assert.equal(verifyLocalModelOutput(request, { ...original, tool: 'crm' }).accepted, false);
  assert.equal(verifyLocalModelOutput(request, { ...original, actionIds: [...original.actionIds, 'confirm_payment'] }).accepted, false);
  assert.equal(verifyLocalModelOutput(request, { ...original, citationIds: [...original.citationIds].reverse() }).accepted, false);
});

test('R07 model response has no path that authorizes an external operation', () => {
  const request = prepare('pricing');
  const approved = resolveLocalModelOutput(request, localModelFixture(request));
  assert.equal(approved.accepted, true);
  assert.ok(approved.sources.length > 0);
  assert.equal(Object.hasOwn(approved, 'tool'), false);
  assert.equal(Object.hasOwn(approved, 'payment'), false);
  assert.equal(Object.hasOwn(approved, 'sent'), false);
  assert.deepEqual(approved.actions.map(item => item.id), getGroundedAnswer('pricing').actions.map(item => item.id));
});

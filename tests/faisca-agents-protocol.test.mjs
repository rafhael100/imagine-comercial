import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { KNOWLEDGE } from '../ops/faisca/knowledge.mjs';
import { createSession, getActionCatalog, respond } from '../ops/faisca/core.mjs';
import { CONVERSATION_SCHEMA, conversationFingerprint, createConversationResponse } from '../ops/faisca/conversation-contract.mjs';
import { AGENTS_REQUEST_SCHEMA, AGENTS_RESULT_SCHEMA, AGENTS_ERROR_SCHEMA, AGENTS_MAX_BYTES,
  createAgentsRequest, validateAgentsRequest, validateAgentsResult, validateAgentsError,
  validatePublicContext, parseAgentsOutput } from '../ops/faisca/agents/protocol.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = { knowledgeVersion: KNOWLEDGE.version,
  knowledgeDigest: sha256(await readFile(new URL('../ops/faisca/knowledge.mjs', import.meta.url))) };
const request = { schema: CONVERSATION_SCHEMA, conversationId: 'conversation_synthetic_01',
  messageId: 'message_synthetic_0001', locale: 'pt-BR',
  input: { type: 'text', text: 'Quero avaliar um site para minha empresa sintética.' } };
const candidate = createConversationResponse(request, respond(createSession(), request.input).reply);
const wire = await createAgentsRequest(request, candidate, { ...pin, invocationId: 'ab'.repeat(16) });
const policy = { schema: 'faisca.public-context.v1', scope: 'public_comercial', ...pin,
  sourceIds: Object.values(KNOWLEDGE.sources).map(source => source.id), actionIds: Object.keys(getActionCatalog()) };
const result = () => ({ schema: AGENTS_RESULT_SCHEMA, invocationId: wire.invocationId,
  requestFingerprint: wire.requestFingerprint, candidateDigest: wire.candidateDigest,
  conversationId: wire.conversationId, messageId: wire.messageId, locale: wire.locale,
  context: { scope: 'public_comercial', ...pin },
  suggestion: { kind: 'SYNTHETIC_SUGGESTION', version: 'mock-v1', run: 'SYNTHETIC_' + wire.invocationId.toUpperCase(),
    source: 'SYNTHETIC_FAISCA_PUBLIC', text: 'SYNTHETIC summary proposal only' },
  evidence: { runState: 'CONCLUIDA', suggestions: 1, effects: 0, knowledgePassages: 1 }, operationalEffects: false });
const encode = value => Buffer.from(JSON.stringify(value) + '\n');

test('Agents framing contains canonical fingerprints and curated references, never visitor or reply text', async () => {
  assert.equal(wire.schema, AGENTS_REQUEST_SCHEMA);
  assert.equal(wire.requestFingerprint, await conversationFingerprint(request));
  assert.equal(wire.candidateDigest, sha256(JSON.stringify(candidate)));
  assert.deepEqual(wire.context.sourceIds, candidate.sources.map(source => source.id));
  assert.deepEqual(wire.context.actionIds, candidate.actions.map(action => action.id));
  const body = JSON.stringify(wire);
  assert.ok(Buffer.byteLength(body) <= AGENTS_MAX_BYTES);
  assert.ok(!body.includes(request.input.text)); assert.ok(!body.includes(candidate.text));
  assert.ok(!body.includes('Bearer')); assert.ok(!Object.hasOwn(wire, 'input'));
  const reordered = await createAgentsRequest({ input: request.input, locale: request.locale, messageId: request.messageId,
    conversationId: request.conversationId, schema: request.schema }, { actions: candidate.actions, sources: candidate.sources,
    text: candidate.text, knowledgeVersion: candidate.knowledgeVersion, locale: candidate.locale,
    messageId: candidate.messageId, conversationId: candidate.conversationId, schema: candidate.schema },
  { ...pin, invocationId: wire.invocationId });
  assert.deepEqual(reordered, wire);
  assert.ok(Object.isFrozen(wire.context.sourceIds));
});

test('the normative context requires the complete local allowlists and exact knowledge version/digest', () => {
  assert.ok(validatePublicContext(policy, pin));
  for (const change of [{ scope: 'customer' }, { knowledgeVersion: 'invented' }, { knowledgeDigest: '0'.repeat(64) },
    { sourceIds: policy.sourceIds.slice(1) }, { actionIds: [...policy.actionIds, 'purchase'] }, { tenant: 'forged' }]) {
    assert.equal(validatePublicContext({ ...policy, ...change }, pin), null);
  }
});

test('closed request rejects authority, unknown references, duplicate arrays and executable properties', () => {
  assert.ok(validateAgentsRequest(wire, pin));
  const bad = [{ ...wire, role: 'admin' }, { ...wire, locale: 'en-US' },
    { ...wire, context: { ...wire.context, scope: 'customer' } },
    { ...wire, context: { ...wire.context, sourceIds: ['unknown'] } },
    { ...wire, context: { ...wire.context, actionIds: ['purchase'] } },
    { ...wire, context: { ...wire.context, sourceIds: [wire.context.sourceIds[0], wire.context.sourceIds[0]] } },
    Object.assign(Object.create({}), wire), { ...wire, [Symbol('hidden')]: true }];
  let accessed = 0;
  bad.push(Object.defineProperty({ ...wire }, 'invocationId', { get() { accessed++; throw Error('private'); } }));
  const proxy = Proxy.revocable({}, {}); proxy.revoke(); bad.push(proxy.proxy);
  for (const value of bad) assert.equal(validateAgentsRequest(value, pin), null);
  assert.equal(accessed, 0);
});

test('success requires exact invocation, hashes, IDs, context, synthetic suggestion and zero effects', () => {
  assert.ok(validateAgentsResult(result(), wire));
  for (const key of ['invocationId', 'requestFingerprint', 'candidateDigest', 'conversationId', 'messageId', 'locale']) {
    assert.equal(validateAgentsResult({ ...result(), [key]: 'altered' }, wire), null);
  }
  for (const change of [{ context: { ...result().context, knowledgeVersion: 'invented' } },
    { context: { ...result().context, knowledgeDigest: '0'.repeat(64) } },
    { context: { ...result().context, role: 'admin' } },
    { suggestion: { ...result().suggestion, source: 'UNKNOWN' } },
    { suggestion: { ...result().suggestion, text: 'Pagamento confirmado.' } },
    { suggestion: { ...result().suggestion, run: 'SYNTHETIC_UNRELATED' } },
    { evidence: { ...result().evidence, effects: 1 } },
    { evidence: { ...result().evidence, knowledgePassages: 0 } }, { operationalEffects: true }, { authorize: true }]) {
    assert.equal(validateAgentsResult({ ...result(), ...change }, wire), null);
  }
});

test('success validators reject accessors and prototypes without reading their values', () => {
  let accessed = 0;
  const getter = Object.defineProperty(result(), 'suggestion', { get() { accessed++; throw Error('private'); } });
  const inherited = Object.assign(Object.create({ tenant: 'private' }), result());
  const proxy = Proxy.revocable({}, {}); proxy.revoke();
  for (const value of [getter, inherited, proxy.proxy, { ...result(), [Symbol('extra')]: 1 }]) {
    assert.equal(validateAgentsResult(value, wire), null);
  }
  assert.equal(accessed, 0);
});

test('stdout requires one bounded compact UTF-8 JSON document and exactly one trailing LF', () => {
  assert.equal(parseAgentsOutput(encode(result()), wire).kind, 'result');
  const valid = JSON.stringify(result());
  for (const bytes of [Buffer.from(valid), Buffer.from(valid + '\n\n'), Buffer.from('log\n' + valid + '\n'),
    Buffer.from(JSON.stringify(result(), null, 2) + '\n'), Buffer.from(valid + '\n{}\n'),
    Buffer.from(valid.replace('"schema":', '"schema":"discarded","schema":') + '\n'),
    Buffer.from([0xff, 0xfe, 0x0a]), Buffer.alloc(AGENTS_MAX_BYTES + 1, 32)]) {
    assert.equal(parseAgentsOutput(bytes, wire), null);
  }
});

test('known errors carry only a closed code and cannot smuggle text or a success claim', () => {
  for (const code of ['invalid_request', 'context_denied', 'source_denied', 'invalid_suggestion', 'lab_disabled', 'unavailable']) {
    const value = { schema: AGENTS_ERROR_SCHEMA, code };
    assert.ok(validateAgentsError(value));
    assert.deepEqual(parseAgentsOutput(encode(value), wire), { kind: 'error', code });
  }
  for (const value of [{ schema: AGENTS_ERROR_SCHEMA, code: 'executed' },
    { schema: AGENTS_ERROR_SCHEMA, code: 'unavailable', text: 'private' }]) {
    assert.equal(validateAgentsError(value), null); assert.equal(parseAgentsOutput(encode(value), wire), null);
  }
});

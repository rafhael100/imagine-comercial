import { createHash } from 'node:crypto';
import { KNOWLEDGE } from '../knowledge.mjs';
import { validateConversationRequest, validateConversationResponse, conversationFingerprint } from '../conversation-contract.mjs';
import { AGENTS_REQUEST_SCHEMA, AGENTS_REQUIRED_FILES, AGENTS_MAX_BYTES,
  validateAgentsRequest, validateAgentsResult } from '../agents/protocol.mjs';
import { CATALOG, CATALOG_SHA256 } from './catalog.mjs';
import { findGroundedAnswer, getGroundedAnswer } from './guide.mjs';

export const GROUNDED_REQUEST_SCHEMA = 'faisca.grounded.request.v1';
export const GROUNDED_RESULT_SCHEMA = 'faisca.grounded.result.v1';
export const GROUNDED_ERROR_SCHEMA = 'faisca.grounded.error.v1';
export const GROUNDED_ENTRYPOINT = 'tools/faisca_grounded_bridge.php';
export const GROUNDED_CATALOG_PATH = 'contracts/faisca/public-passages-v1.json';
// Includes the R05 CLI as a compatibility pin; R06 does not execute that CLI.
export const GROUNDED_REQUIRED_FILES = Object.freeze([...AGENTS_REQUIRED_FILES,
  GROUNDED_ENTRYPOINT, GROUNDED_CATALOG_PATH,
  'src/Integration/Faisca/PublicPassageCatalog.php',
  'src/Integration/Faisca/GroundedConversationBridge.php']);

const sha256 = value => createHash('sha256').update(value).digest('hex');
const sourceIds = new Map(Object.values(KNOWLEDGE.sources).map(source => [source.path, source.id]));
const passageKeys = ['id', 'title', 'sourcePath', 'selector', 'text', 'digest', 'factKey', 'factValue', 'trust'];
const refusalCodes = new Set(['invalid_request', 'context_denied', 'source_denied', 'invalid_suggestion',
  'lab_disabled', 'unavailable', 'grounding_denied']);

function record(value, keys) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const own = Reflect.ownKeys(value);
    if (own.length !== keys.length || own.some(key => !keys.includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const data = {};
    for (const key of keys) {
      if (!Object.hasOwn(descriptors[key], 'value')) return null;
      data[key] = descriptors[key].value;
    }
    return data;
  } catch { return null; }
}

function exactList(value, expected, readItem = (item, original) => item === original ? item : null) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (descriptors.length?.value !== expected.length || Reflect.ownKeys(value).length !== expected.length + 1) return null;
    const result = [];
    for (let index = 0; index < expected.length; index++) {
      const descriptor = descriptors[index];
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
      const item = readItem(descriptor.value, expected[index]);
      if (item === null) return null;
      result.push(item);
    }
    return Object.freeze(result);
  } catch { return null; }
}

function passagesFor(answer) {
  return answer.passageIds.map(id => CATALOG.passages.find(passage => passage.id === id));
}

function candidateFor(wire, answer) {
  return { schema: 'faisca.response.v1', conversationId: wire.conversationId, messageId: wire.messageId,
    locale: 'pt-BR', knowledgeVersion: KNOWLEDGE.version, text: answer.text,
    sources: answer.sources.map(source => ({ id: source.id, version: source.version })),
    actions: answer.actions.map(action => ({ id: action.id })) };
}

function bindingDigest(wire, passages) {
  return sha256(JSON.stringify({ catalogVersion: CATALOG.version, catalogDigest: CATALOG_SHA256,
    answerId: wire.grounding.answerId, candidateDigest: wire.candidateDigest,
    passageIds: wire.grounding.passageIds, passageDigests: passages.map(passage => passage.digest) }));
}

function executionRequest(wire, answer, pin) {
  return validateAgentsRequest({ schema: AGENTS_REQUEST_SCHEMA,
    invocationId: wire.invocationId, requestFingerprint: wire.requestFingerprint, candidateDigest: wire.candidateDigest,
    conversationId: wire.conversationId, messageId: wire.messageId, locale: wire.locale,
    context: { scope: 'public_comercial', knowledgeVersion: pin.knowledgeVersion, knowledgeDigest: pin.knowledgeDigest,
      sourceIds: [...new Set(passagesFor(answer).map(passage => sourceIds.get(passage.sourcePath)))],
      actionIds: answer.actions.map(action => action.id) } }, pin);
}

export function validateGroundedRequest(value, pin) {
  const data = record(value, ['schema', 'invocationId', 'requestFingerprint', 'candidateDigest',
    'conversationId', 'messageId', 'locale', 'grounding']);
  const grounding = data && record(data.grounding, ['catalogVersion', 'catalogDigest', 'answerId', 'passageIds']);
  if (!data || !pin || data.schema !== GROUNDED_REQUEST_SCHEMA || !grounding ||
      grounding.catalogVersion !== CATALOG.version || grounding.catalogDigest !== CATALOG_SHA256 ||
      typeof grounding.answerId !== 'string') return null;
  const answer = getGroundedAnswer(grounding.answerId);
  const passageIds = answer && exactList(grounding.passageIds, answer.passageIds);
  if (!answer || !passageIds) return null;
  const execution = executionRequest(data, answer, pin);
  if (!execution) return null;
  if (sha256(JSON.stringify(candidateFor(execution, answer))) !== execution.candidateDigest) return null;
  const { context: _context, ...correlation } = execution;
  return Object.freeze({ ...correlation, schema: GROUNDED_REQUEST_SCHEMA,
    grounding: Object.freeze({ ...grounding, passageIds }) });
}

export async function createGroundedRequest(requestValue, candidateValue, { invocationId, knowledgeVersion, knowledgeDigest }) {
  const request = validateConversationRequest(requestValue);
  const candidate = request && validateConversationResponse(candidateValue, request);
  const answer = candidate && findGroundedAnswer(candidate);
  if (!answer) throw new TypeError('The answer has no exact reviewed passage binding.');
  const wire = validateGroundedRequest({ schema: GROUNDED_REQUEST_SCHEMA, invocationId,
    requestFingerprint: await conversationFingerprint(request), candidateDigest: sha256(JSON.stringify(candidate)),
    conversationId: request.conversationId, messageId: request.messageId, locale: 'pt-BR',
    grounding: { catalogVersion: CATALOG.version, catalogDigest: CATALOG_SHA256,
      answerId: answer.id, passageIds: answer.passageIds }
  }, { knowledgeVersion, knowledgeDigest });
  if (!wire) throw new TypeError('Invalid grounded process request.');
  return wire;
}

export function validateGroundedResult(value, expected, pin) {
  const data = record(value, ['schema', 'execution', 'grounding']);
  if (!data || data.schema !== GROUNDED_RESULT_SCHEMA || !expected) return null;
  const wire = validateGroundedRequest(expected, pin);
  if (!wire) return null;
  const answer = getGroundedAnswer(wire.grounding.answerId);
  const execution = validateAgentsResult(data.execution, executionRequest(wire, answer, pin));
  const grounding = record(data.grounding, ['catalogVersion', 'catalogDigest', 'answerId', 'passageIds',
    'passages', 'text', 'bindingDigest']);
  if (!execution || !grounding || !answer || grounding.catalogVersion !== CATALOG.version ||
      grounding.catalogDigest !== CATALOG_SHA256 || grounding.answerId !== answer.id || grounding.text !== answer.text) return null;
  const passageIds = exactList(grounding.passageIds, answer.passageIds);
  const expectedPassages = passagesFor(answer);
  const passages = exactList(grounding.passages, expectedPassages, (value, expectedPassage) => {
    const passage = record(value, passageKeys);
    if (!passage || passage.trust !== 'UNTRUSTED_DATA' ||
        Object.keys(expectedPassage).some(key => passage[key] !== expectedPassage[key])) return null;
    return Object.freeze(passage);
  });
  if (!passageIds || !passages || grounding.bindingDigest !== bindingDigest(expected, expectedPassages)) return null;
  return Object.freeze({ schema: GROUNDED_RESULT_SCHEMA, execution,
    grounding: Object.freeze({ ...grounding, passageIds, passages }) });
}

export function parseGroundedOutput(bytes, expected, pin) {
  try {
    if (!(bytes instanceof Uint8Array) || bytes.length > AGENTS_MAX_BYTES) return null;
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const value = JSON.parse(text);
    if (JSON.stringify(value) + '\n' !== text) return null;
    const result = validateGroundedResult(value, expected, pin);
    if (result) return Object.freeze({ kind: 'result', value: result });
    const refusal = record(value, ['schema', 'code']);
    if (refusal?.schema === GROUNDED_ERROR_SCHEMA && refusalCodes.has(refusal.code)) {
      return Object.freeze({ kind: 'error', code: refusal.code });
    }
    return null;
  } catch { return null; }
}

// The accepted prose comes from the validated PHP result. Exact candidate
// equality is checked again; the worker cannot add a claim or change a source.
export function finishGroundedResponse(result, candidate, request) {
  const response = validateConversationResponse({ ...candidate, text: result.grounding.text }, request);
  if (!response || JSON.stringify(response) !== JSON.stringify(candidate)) throw new TypeError('Grounded response changed.');
  return response;
}

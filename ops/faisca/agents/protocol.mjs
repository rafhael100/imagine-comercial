import { createHash } from 'node:crypto';
import { KNOWLEDGE } from '../knowledge.mjs';
import { getActionCatalog } from '../core.mjs';
import { conversationFingerprint, validateConversationRequest,
  validateConversationResponse } from '../conversation-contract.mjs';

// Private process framing for the synthetic Agents laboratory. None of these
// references, hashes or nonces authenticate a customer or authorize an effect.
export const AGENTS_REQUEST_SCHEMA = 'faisca.agents.request.v1';
export const AGENTS_RESULT_SCHEMA = 'faisca.agents.result.v1';
export const AGENTS_ERROR_SCHEMA = 'faisca.agents.error.v1';
export const AGENTS_POLICY_PATH = 'contracts/faisca/public-context-v1.json';
export const AGENTS_ENTRYPOINT = 'tools/faisca_public_bridge.php';
export const AGENTS_MAX_BYTES = 16 * 1024;
export const AGENTS_REQUIRED_FILES = Object.freeze([
  AGENTS_ENTRYPOINT, AGENTS_POLICY_PATH,
  'src/Domain/MockError.php', 'src/Domain/TenantContext.php',
  'src/Contracts/AiSuggestionProvider.php', 'src/Contracts/CrmEffectGateway.php',
  'src/Domain/Run.php', 'src/Domain/Step.php',
  'src/MockCatalog/MockAgentVersionSnapshot.php',
  'src/MockKnowledge/MockKnowledgeSource.php', 'src/MockKnowledge/MockKnowledgeCatalog.php',
  'src/MockKnowledge/MockKnowledgeTrace.php', 'src/MockKnowledge/MockRetrievalGrant.php',
  'src/MockKnowledge/MockKnowledgeRetriever.php', 'src/MockKnowledge/MockContextEnvelope.php',
  'src/Mocks/MockAiSuggestionProvider.php', 'src/MockOrchestration/SupervisedCoordinator.php',
  'src/Integration/Faisca/DenyOnlyEffectGateway.php',
  'src/Integration/Faisca/PublicConversationBridge.php'
]);

const sourceIds = Object.freeze(Object.values(KNOWLEDGE.sources).map(source => source.id));
const actionIds = Object.freeze(Object.keys(getActionCatalog()));
const errorCodes = new Set(['invalid_request', 'context_denied', 'source_denied',
  'invalid_suggestion', 'lab_disabled', 'unavailable']);
const hex = (value, size) => typeof value === 'string' && new RegExp('^[a-f0-9]{' + size + '}$').test(value);
const opaqueId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,96}$/.test(value);
const sha256 = value => createHash('sha256').update(value).digest('hex');

function record(value, keys) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const own = Reflect.ownKeys(value);
    if (own.length !== keys.length || own.some(key => !keys.includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result = {};
    for (const key of keys) {
      if (!Object.hasOwn(descriptors[key], 'value')) return null;
      result[key] = descriptors[key].value;
    }
    return result;
  } catch { return null; }
}

function ids(value, allowed, max) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = descriptors.length?.value;
    if (!Number.isInteger(length) || length < 0 || length > max || Reflect.ownKeys(value).length !== length + 1) return null;
    const result = [];
    for (let index = 0; index < length; index++) {
      const item = descriptors[index];
      if (!item || !Object.hasOwn(item, 'value') || !allowed.includes(item.value) || result.includes(item.value)) return null;
      result.push(item.value);
    }
    return Object.freeze(result);
  } catch { return null; }
}

export function validatePublicContext(value, pin) {
  const data = record(value, ['schema', 'scope', 'knowledgeVersion', 'knowledgeDigest', 'sourceIds', 'actionIds']);
  if (!data || data.schema !== 'faisca.public-context.v1' || data.scope !== 'public_comercial' ||
      data.knowledgeVersion !== KNOWLEDGE.version || data.knowledgeVersion !== pin.knowledgeVersion ||
      !hex(data.knowledgeDigest, 64) || data.knowledgeDigest !== pin.knowledgeDigest) return null;
  const sources = ids(data.sourceIds, sourceIds, sourceIds.length);
  const actions = ids(data.actionIds, actionIds, actionIds.length);
  if (sources?.length !== sourceIds.length || actions?.length !== actionIds.length) return null;
  return Object.freeze({ ...data, sourceIds: sources, actionIds: actions });
}

export function validateAgentsRequest(value, pin) {
  const data = record(value, ['schema', 'invocationId', 'requestFingerprint', 'candidateDigest',
    'conversationId', 'messageId', 'locale', 'context']);
  const context = data && record(data.context, ['scope', 'knowledgeVersion', 'knowledgeDigest', 'sourceIds', 'actionIds']);
  if (!data || data.schema !== AGENTS_REQUEST_SCHEMA || !hex(data.invocationId, 32) ||
      !hex(data.requestFingerprint, 64) || !hex(data.candidateDigest, 64) ||
      !opaqueId(data.conversationId) || !opaqueId(data.messageId) || data.locale !== 'pt-BR' ||
      !context || context.scope !== 'public_comercial' || context.knowledgeVersion !== KNOWLEDGE.version ||
      context.knowledgeVersion !== pin.knowledgeVersion || !hex(context.knowledgeDigest, 64) ||
      context.knowledgeDigest !== pin.knowledgeDigest) return null;
  const sources = ids(context.sourceIds, sourceIds, 4);
  const actions = ids(context.actionIds, actionIds, 6);
  if (!sources || !actions) return null;
  return Object.freeze({ ...data, context: Object.freeze({ ...context, sourceIds: sources, actionIds: actions }) });
}

export async function createAgentsRequest(requestValue, candidateValue, { invocationId, knowledgeVersion, knowledgeDigest }) {
  const request = validateConversationRequest(requestValue);
  const candidate = request && validateConversationResponse(candidateValue, request);
  if (!candidate) throw new TypeError('Invalid synthetic Agents input.');
  const wire = validateAgentsRequest({ schema: AGENTS_REQUEST_SCHEMA, invocationId,
    requestFingerprint: await conversationFingerprint(request), candidateDigest: sha256(JSON.stringify(candidate)),
    conversationId: request.conversationId, messageId: request.messageId, locale: request.locale,
    context: { scope: 'public_comercial', knowledgeVersion, knowledgeDigest,
      sourceIds: candidate.sources.map(source => source.id), actionIds: candidate.actions.map(action => action.id) }
  }, { knowledgeVersion, knowledgeDigest });
  if (!wire) throw new TypeError('Invalid synthetic Agents input.');
  return wire;
}

export function validateAgentsResult(value, expected) {
  const data = record(value, ['schema', 'invocationId', 'requestFingerprint', 'candidateDigest',
    'conversationId', 'messageId', 'locale', 'context', 'suggestion', 'evidence', 'operationalEffects']);
  if (!data || data.schema !== AGENTS_RESULT_SCHEMA || !expected ||
      ['invocationId', 'requestFingerprint', 'candidateDigest', 'conversationId', 'messageId', 'locale']
        .some(key => data[key] !== expected[key]) || data.operationalEffects !== false) return null;
  const context = record(data.context, ['scope', 'knowledgeVersion', 'knowledgeDigest']);
  const suggestion = record(data.suggestion, ['kind', 'version', 'run', 'source', 'text']);
  const evidence = record(data.evidence, ['runState', 'suggestions', 'effects', 'knowledgePassages']);
  if (!context || Object.keys(context).some(key => context[key] !== expected.context[key]) ||
      !suggestion || suggestion.kind !== 'SYNTHETIC_SUGGESTION' || suggestion.version !== 'mock-v1' ||
      suggestion.run !== 'SYNTHETIC_' + expected.invocationId.toUpperCase() ||
      suggestion.source !== 'SYNTHETIC_FAISCA_PUBLIC' || suggestion.text !== 'SYNTHETIC summary proposal only' ||
      !evidence || evidence.runState !== 'CONCLUIDA' || evidence.suggestions !== 1 ||
      evidence.effects !== 0 || evidence.knowledgePassages !== 1) return null;
  return Object.freeze({ ...data, context: Object.freeze(context), suggestion: Object.freeze(suggestion),
    evidence: Object.freeze(evidence) });
}

export function validateAgentsError(value) {
  const data = record(value, ['schema', 'code']);
  return data?.schema === AGENTS_ERROR_SCHEMA && errorCodes.has(data.code) ? Object.freeze(data) : null;
}

// Compact JSON followed by exactly one LF also rejects duplicate keys,
// diagnostic prefixes, extra JSON documents and ambiguous trailing output.
export function parseAgentsOutput(bytes, expected) {
  try {
    if (!(bytes instanceof Uint8Array) || bytes.length > AGENTS_MAX_BYTES) return null;
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const value = JSON.parse(text);
    if (JSON.stringify(value) + '\n' !== text) return null;
    const result = validateAgentsResult(value, expected);
    if (result) return Object.freeze({ kind: 'result', value: result });
    const error = validateAgentsError(value);
    return error ? Object.freeze({ kind: 'error', code: error.code }) : null;
  } catch { return null; }
}

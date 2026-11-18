import { KNOWLEDGE } from './knowledge.mjs';
import { createConversationResponse, validateConversationResponse, conversationResponseToReply } from './conversation-contract.mjs';

// This protocol belongs only to the explicitly enabled loopback laboratory.
// A public conversation token is not a customer identity, tenant grant or cost reservation.
export const HTTP_SESSION_SCHEMA = 'faisca.http.session.v1';
export const HTTP_RESULT_SCHEMA = 'faisca.http.result.v1';
export const HTTP_ERROR_SCHEMA = 'faisca.http.error.v1';
export const HTTP_PATHS = Object.freeze({ sessions: '/__faisca_lab/sessions',
  messages: '/__faisca_lab/messages', reconcile: '/__faisca_lab/reconcile', session: '/__faisca_lab/session' });
export const HTTP_CONTEXT = Object.freeze({ scope: 'public_comercial', knowledgeVersion: KNOWLEDGE.version,
  provider: 'simulated', operationalEffects: false });

const statuses = new Set(['answered', 'unavailable', 'provider_limit', 'invalid_response', 'unknown',
  'busy', 'conflict', 'limit', 'invalid_request', 'cancelled', 'closed', 'not_found']);
const reasons = new Set([...statuses, 'sensitive_input', 'unsupported_instruction', 'invalid_input',
  'too_long', 'invalid_session', 'invalid_signal', 'pending', 'timeout_after_dispatch', 'cancelled_after_dispatch', 'provider_unknown',
  'grounding_navigation', 'grounding_boundary', 'grounding_unsupported', 'grounding_ambiguous',
  'journey_confirmation_needed', 'journey_cancelled', 'journey_no_pending',
  'journey_confirmation_refused', 'journey_invalid', 'journey_summary', 'summary',
  'r08_service_choice', 'r08_service_change_pending', 'r08_qualification_question', 'r08_qualification_complete',
  'r08_qualification_summary', 'r08_invalid_input', 'r08_restart', 'r08_service_qualification_unavailable']);
const errorCodes = new Set(['invalid_host', 'invalid_origin', 'invalid_headers', 'invalid_path',
  'method_not_allowed', 'invalid_content_type', 'unsupported_encoding', 'invalid_framing', 'body_too_large',
  'body_timeout', 'invalid_json', 'invalid_request', 'unauthorized', 'conversation_mismatch',
  'session_capacity', 'not_found', 'server_closed', 'internal_error']);

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

export function validateHttpSession(value) {
  const data = record(value, ['schema', 'conversationId', 'token', 'expiresInMs', 'context']);
  const context = data && record(data.context, Object.keys(HTTP_CONTEXT));
  if (!data || data.schema !== HTTP_SESSION_SCHEMA || typeof data.conversationId !== 'string' ||
      !/^[a-f0-9]{32}$/.test(data.conversationId) || typeof data.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token) ||
      !Number.isInteger(data.expiresInMs) || data.expiresInMs < 1 || data.expiresInMs > 3600000 ||
      !context || Object.keys(HTTP_CONTEXT).some(key => context[key] !== HTTP_CONTEXT[key])) return null;
  return Object.freeze({ ...data, context: HTTP_CONTEXT });
}

export function validateHttpResult(value, request) {
  const data = record(value, ['schema', 'status', 'delivery', 'accepted', 'reason', 'response']);
  if (!data || data.schema !== HTTP_RESULT_SCHEMA || !statuses.has(data.status) || !reasons.has(data.reason) ||
      typeof data.accepted !== 'boolean') return null;
  const response = validateConversationResponse(data.response, request);
  if (!response) return null;
  let consistent;
  if (data.status === 'answered') consistent = data.accepted && ['simulated', 'guided_fallback'].includes(data.delivery);
  else if (data.status === 'unknown') consistent = data.accepted && data.delivery === 'unknown';
  else if (['unavailable', 'provider_limit', 'invalid_response'].includes(data.status)) {
    consistent = data.accepted ? data.delivery === 'guided_fallback' : data.delivery === 'none';
  } else consistent = !data.accepted && data.delivery === 'none';
  return consistent ? Object.freeze({ ...data, response }) : null;
}

export function createHttpResult(request, outcome) {
  const result = validateHttpResult({ schema: HTTP_RESULT_SCHEMA, status: outcome.status,
    delivery: outcome.delivery, accepted: outcome.accepted, reason: outcome.reason,
    response: createConversationResponse(request, outcome.reply) }, request);
  if (!result) throw new TypeError('Invalid laboratory HTTP result.');
  return result;
}

export function httpResultToOutcome(result) {
  const reply = conversationResponseToReply(result.response);
  return Object.freeze({ status: result.status, delivery: result.delivery, accepted: result.accepted,
    reason: result.reason, reply: Object.freeze({ ...reply,
      state: result.status === 'answered' ? 'TALK' : ['unknown', 'busy'].includes(result.status) ? 'WAIT' : 'ERROR' }),
    mode: 'simulated_lab', operationalEffects: false });
}

export function validateHttpError(value) {
  const data = record(value, ['schema', 'code']);
  return data?.schema === HTTP_ERROR_SCHEMA && errorCodes.has(data.code) ? Object.freeze(data) : null;
}

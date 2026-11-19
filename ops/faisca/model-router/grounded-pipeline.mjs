import { createHash } from 'node:crypto';
import { createConversationRuntime } from '../conversation-runtime.mjs';
import { CONVERSATION_SCHEMA } from '../conversation-contract.mjs';
import { groundedRespond } from '../grounding/guide.mjs';
import { createModelRouteRuntime } from './runtime.mjs';
import { getFixedRouteClarification } from './contract.mjs';

const groundedAnswerIds = new Set([
  'compare_sites', 'channel_compare', 'pricing', 'results', 'scope', 'process'
]);
const safeFallback = 'Não consegui confirmar uma resposta editorial agora. Posso reformular sua dúvida ou pedir que a equipe confirme esse assunto.';
function clarificationFor(answerId) {
  if (['goal_presence', 'goal_campaign'].includes(answerId)) return 'service_choice';
  if (['channel_google', 'channel_meta'].includes(answerId)) return 'goal_clarification';
  if (answerId === 'materials_help') return 'audience_clarification';
  return 'support_unknown';
}

function readInput(value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 3 || keys.some(key => !['conversationId', 'messageId', 'userText'].includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (keys.some(key => !Object.hasOwn(descriptors[key], 'value'))) return null;
    // Descriptors were already validated as own DATA properties. Read
    // their stored values rather than re-reading the untrusted object:
    // a Proxy could otherwise execute its get trap after the descriptor gate.
    const conversationId = descriptors.conversationId.value;
    const messageId = descriptors.messageId.value;
    const userText = descriptors.userText.value;
    if (typeof conversationId !== 'string' || typeof messageId !== 'string' ||
        typeof userText !== 'string') return null;
    return Object.freeze({ conversationId, messageId, userText });
  } catch { return null; }
}

function requestForGrounding(input, answerId) {
  const isolatedConversationId = createHash('sha256')
    .update(input.conversationId + ':' + input.messageId).digest('hex').slice(0, 32);
  return Object.freeze({
    schema: CONVERSATION_SCHEMA,
    conversationId: isolatedConversationId,
    messageId: input.messageId + '_r06',
    locale: 'pt-BR',
    input: Object.freeze({ type: 'action', id: answerId })
  });
}

function hostClarification(id) {
  return Object.freeze({
    status: 'answered', delivery: 'fixed_clarification', accepted: true,
    route: Object.freeze({ routeStatus: 'clarify', answerId: null,
      clarificationId: id, provenance: 'host_fixed_clarification' }),
    reply: Object.freeze({ text: getFixedRouteClarification(id), sources: Object.freeze([]), actions: Object.freeze([]) }),
    externalModelInvocations: 0, operationalEffects: false
  });
}

function pendingResult(status, route = null, reason = status) {
  const text = status === 'unknown'
    ? 'A resposta ainda não foi confirmada. Consulte novamente; nenhuma nova tentativa foi enviada.'
    : status === 'busy' ? 'Uma resposta anterior ainda está pendente. Aguarde ou consulte o resultado.'
      : 'Não consegui confirmar essa resposta. Reformule sua dúvida ou tente novamente mais tarde.';
  return Object.freeze({
    status, delivery: status === 'unknown' ? 'unknown' : 'none', accepted: status === 'unknown',
    reason, route, reply: Object.freeze({ text,
      sources: Object.freeze([]), actions: Object.freeze([]) }),
    externalModelInvocations: 0, operationalEffects: false
  });
}

/**
 * R09 candidate selection followed by R06 PHP source verification.
 * The route provider is simulated-only; the second provider must be the
 * simulated R06 bridge (normally a pinned real PHP CLI process in CI).
 */
export function createGroundedModelPipeline({
  routeProvider, groundedProvider, routeTimeoutMs = 250, groundedTimeoutMs = 2500,
  maxEntries = 64, routeQuota
} = {}) {
  if (!groundedProvider || groundedProvider.kind !== 'simulated' ||
      typeof groundedProvider.respond !== 'function') {
    throw new TypeError('A simulated grounded R06 provider is required.');
  }
  // R33: host-owned, synthetic-only quota gates R09 BEFORE any R06/PHP
  // grounding. A quota denial must never dispatch a PHP response or provider.
  const router = createModelRouteRuntime({
    provider: routeProvider, timeoutMs: routeTimeoutMs, maxEntries, quota: routeQuota
  });
  const grounder = createConversationRuntime({
    provider: groundedProvider, timeoutMs: groundedTimeoutMs, maxEntries,
    prepareTurn: groundedRespond
  });

  function combine(routeResult, groundingResult) {
    if (groundingResult.status === 'answered' && groundingResult.delivery === 'simulated') {
      return Object.freeze({
        status: 'answered', delivery: 'php_grounded', accepted: true,
        route: routeResult.route,
        reply: groundingResult.reply,
        externalModelInvocations: 0, operationalEffects: false
      });
    }
    const status = groundingResult.status === 'unknown' ? 'unknown' : 'unavailable';
    return pendingResult(status, routeResult.route, 'r06_grounding_not_confirmed');
  }

  async function send(rawInput) {
    const input = readInput(rawInput);
    if (!input) return pendingResult('invalid_request');
    const routeResult = await router.send(input);
    if (routeResult.status !== 'answered') return pendingResult(routeResult.status, null, routeResult.reason);
    if (routeResult.route?.routeStatus !== 'grounded') return Object.freeze({
      ...routeResult,
      reply: Object.freeze({ text: routeResult.route?.text ?? safeFallback,
        sources: routeResult.route?.sources ?? Object.freeze([]),
        actions: routeResult.route?.actions ?? Object.freeze([]) })
    });
    const answerId = routeResult.route.answerId;
    if (!groundedAnswerIds.has(answerId)) return hostClarification(clarificationFor(answerId));
    const groundingRequest = requestForGrounding(input, answerId);
    const groundingResult = await grounder.send(groundingRequest);
    return combine(routeResult, groundingResult);
  }

  async function reconcile(rawInput) {
    const input = readInput(rawInput);
    if (!input) return pendingResult('invalid_request');
    const routeResult = await router.reconcile(input);
    if (routeResult.status !== 'answered') return pendingResult(routeResult.status, null, routeResult.reason);
    if (routeResult.route?.routeStatus !== 'grounded') return Object.freeze({
      ...routeResult,
      reply: Object.freeze({ text: routeResult.route?.text ?? safeFallback,
        sources: routeResult.route?.sources ?? Object.freeze([]),
        actions: routeResult.route?.actions ?? Object.freeze([]) })
    });
    const answerId = routeResult.route.answerId;
    if (!groundedAnswerIds.has(answerId)) return hostClarification(clarificationFor(answerId));
    const groundingRequest = requestForGrounding(input, answerId);
    let groundingResult = await grounder.reconcile(groundingRequest);
    if (groundingResult.status === 'not_found') groundingResult = await grounder.send(groundingRequest);
    return combine(routeResult, groundingResult);
  }

  function destroy() {
    router.destroy();
    grounder.destroy();
  }

  function inspect() {
    return Object.freeze({ route: router.inspect(), grounding: grounder.inspect(),
      externalModelInvocations: 0, operationalEffects: false });
  }

  return Object.freeze({ send, reconcile, destroy, inspect });
}

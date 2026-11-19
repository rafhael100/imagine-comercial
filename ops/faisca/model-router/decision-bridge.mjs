import {
  buildCandidateOnlyRouteEgress, ROUTER_EGRESS_SCHEMA, ROUTER_RESPONSE_SCHEMA
} from './contract.mjs';

export const CANDIDATE_DECISION_SCHEMA = 'faisca.candidate-only-decision.v1';
const DECISION_FIELDS = Object.freeze(['schema', 'mode', 'answerId', 'clarificationId']);

/** Treat selector output as untrusted even when the local fixture returned it.
 * No getters, unknown keys, generated prose, tools, URLs, or source data.
 */
export function validateCandidateOnlyDecision(raw, envelope) {
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(raw)) ||
        Reflect.ownKeys(raw).length !== DECISION_FIELDS.length ||
        !DECISION_FIELDS.every(key => Object.hasOwn(raw, key))) return null;
    const own = Object.getOwnPropertyDescriptors(raw);
    if (!DECISION_FIELDS.every(key => own[key] &&
        Object.hasOwn(own[key], 'value'))) return null;
    const schema = own.schema.value;
    const mode = own.mode.value;
    const answerId = own.answerId.value;
    const clarificationId = own.clarificationId.value;
    if (schema !== CANDIDATE_DECISION_SCHEMA) return null;
    if (mode === 'answer' && typeof answerId === 'string' &&
        envelope.rankedAnswerIds.includes(answerId) && clarificationId === null) {
      return Object.freeze({ routeStatus: 'grounded', answerId, clarificationId: null });
    }
    if (mode === 'clarify' && answerId === null &&
        typeof clarificationId === 'string' &&
        envelope.allowedClarificationIds.includes(clarificationId)) {
      return Object.freeze({ routeStatus: 'clarify', answerId: null, clarificationId });
    }
    return null;
  } catch { return null; }
}

/**
 * R48: host-to-selector boundary. The R09 runtime retains the raw question
 * internally, but the decide callback receives ONLY the R47 frozen envelope.
 * The host reattaches correlation fields after it validates a closed choice.
 *
 * This is a simulated-only adapter; it has no networking, credentials or
 * permission to connect to a model. Running third-party JS in-process is
 * NOT a security sandbox. A future out-of-process transport must use only
 * the envelope and pass AppSec/privacy/budget release gates.
 */
export function createCandidateOnlyDecisionBridge({ decide } = {}) {
  if (typeof decide !== 'function') {
    throw new TypeError('R48 requires an explicitly supplied selector function.');
  }
  return Object.freeze({
    kind: 'simulated',
    route(request) {
      const envelope = buildCandidateOnlyRouteEgress(request);
      if (!envelope || envelope.schema !== ROUTER_EGRESS_SCHEMA ||
          envelope.rankedAnswerIds.length < 1) {
        throw new Error('R48: no trusted editorial candidates for selector.');
      }
      let work;
      try { work = decide(envelope); }
      catch { throw new Error('R48: local candidate selector unavailable.'); }
      return Promise.resolve(work).then(raw => {
        const selection = validateCandidateOnlyDecision(raw, envelope);
        if (!selection) {
          throw new Error('R48: unverified candidate-only selector result.');
        }
        return Object.freeze({
          schema: ROUTER_RESPONSE_SCHEMA,
          invocationId: request.invocationId,
          messageId: request.messageId,
          ...selection
        });
      });
    }
  });
}

/** Fully local deterministic fixture: does not call or model anything. */
export function createCandidateOnlyDecisionFixture({ mode = 'answer' } = {}) {
  if (mode !== 'answer' && mode !== 'clarify') throw new TypeError('Unreviewed fixture mode.');
  return createCandidateOnlyDecisionBridge({
    decide(envelope) {
      return Object.freeze({
        schema: CANDIDATE_DECISION_SCHEMA,
        mode,
        answerId: mode === 'answer' ? envelope.rankedAnswerIds[0] : null,
        clarificationId: mode === 'clarify' ?
          envelope.allowedClarificationIds[0] : null
      });
    }
  });
}

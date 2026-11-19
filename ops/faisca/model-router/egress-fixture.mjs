import {
  buildCandidateOnlyRouteEgress, ROUTER_EGRESS_SCHEMA,
  ROUTER_RESPONSE_SCHEMA
} from './contract.mjs';

/**
 * Laboratory fixture for the future candidate-only server egress protocol.
 * It NEVER calls fetch, a remote LLM, a network endpoint, a tool or a backend.
 * The original request remains host-private, and only the closed ranked IDs
 * enter the mock selection step. Final displayed prose stays R06 verified.
 */
export function createCandidateOnlyLocalSelector() {
  return Object.freeze({
    kind: 'simulated',
    route(request) {
      const payload = buildCandidateOnlyRouteEgress(request);
      if (!payload || payload.schema !== ROUTER_EGRESS_SCHEMA ||
          payload.userTextIncluded !== false ||
          payload.conversationIdIncluded !== false ||
          payload.contactIncluded !== false ||
          !payload.rankedAnswerIds.length) {
        throw new Error('No trusted editorial selection available.');
      }
      const selectedId = payload.rankedAnswerIds[0];
      if (typeof selectedId !== 'string' || !/^[a-z_]{2,40}$/.test(selectedId)) {
        throw new Error('Unreviewed route answer identifier.');
      }
      // No dynamic answer generation: R09's host verifies this choice and
      // R06 separately verifies its public editorial text and citations.
      return Object.freeze({
        schema: ROUTER_RESPONSE_SCHEMA,
        invocationId: request.invocationId,
        messageId: request.messageId,
        routeStatus: 'grounded',
        answerId: selectedId,
        clarificationId: null
      });
    }
  });
}

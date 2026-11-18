import { createConversationOutcome } from '../conversation-runtime.mjs';
import { createHttpResult } from '../http-contract.mjs';

const localReasons = new Set(['grounding_navigation', 'grounding_boundary',
  'grounding_unsupported', 'grounding_ambiguous', 'journey_confirmation_needed',
  'journey_cancelled', 'journey_no_pending', 'journey_confirmation_refused', 'journey_invalid', 'journey_summary']);
const unknownReasons = new Set(['timeout_after_dispatch', 'cancelled_after_dispatch', 'provider_unknown', 'pending']);

/** A valid source ID alone cannot authorize different prose in the browser. */
export function validateGroundedHttpResult(value, request, preparedReply) {
  let expected;
  if (value.status === 'answered') {
    const local = localReasons.has(preparedReply.intent);
    expected = createConversationOutcome('answered', { reply: preparedReply, accepted: true,
      delivery: local ? 'guided_fallback' : 'simulated', reason: local ? preparedReply.intent : 'answered' });
  } else if (['unavailable', 'provider_limit', 'invalid_response'].includes(value.status) && value.accepted) {
    expected = createConversationOutcome(value.status, { reply: preparedReply, accepted: true, delivery: 'guided_fallback' });
  } else if (value.status === 'unknown' && unknownReasons.has(value.reason)) {
    expected = createConversationOutcome('unknown', { reply: preparedReply, accepted: true, delivery: 'unknown', reason: value.reason });
  } else if (['busy', 'conflict', 'limit', 'cancelled', 'closed', 'not_found'].includes(value.status)) {
    expected = createConversationOutcome(value.status);
  } else return false;
  return JSON.stringify(value) === JSON.stringify(createHttpResult(request, expected));
}

import { createConversationOutcome } from '../conversation-runtime.mjs';
import { createHttpResult } from '../http-contract.mjs';

const localReasons = new Set(['grounding_navigation', 'grounding_boundary',
  'grounding_unsupported', 'grounding_ambiguous', 'journey_confirmation_needed',
  'journey_cancelled', 'journey_no_pending', 'journey_confirmation_refused', 'journey_invalid', 'journey_summary',
  'r08_service_choice', 'r08_service_change_pending', 'r08_qualification_question', 'r08_qualification_complete',
  'r08_qualification_summary', 'r08_next_steps', 'r08_invalid_input', 'r08_restart', 'r08_service_qualification_unavailable',
  'r58_portal_preparation_only', 'r58_portal_preparation_unavailable']);
const unknownReasons = new Set(['timeout_after_dispatch', 'cancelled_after_dispatch', 'provider_unknown', 'pending']);

/** The R07 PHP candidate is validated independently from trusted R08 presentation. */
export function validateGroundedHttpResult(value, request, preparedReply, providerReply = null) {
  let expected;
  if (value.status === 'answered') {
    const local = !providerReply && localReasons.has(preparedReply.intent);
    const reply = providerReply
      ? Object.freeze({ ...preparedReply, sources: providerReply.sources })
      : preparedReply;
    expected = createConversationOutcome('answered', { reply, accepted: true,
      delivery: local ? 'guided_fallback' : 'simulated', reason: local ? preparedReply.intent : 'answered' });
  } else if (['unavailable', 'provider_limit', 'invalid_response'].includes(value.status) && value.accepted) {
    const reply = providerReply ? Object.freeze({ ...preparedReply, sources: Object.freeze([]) }) : preparedReply;
    expected = createConversationOutcome(value.status, { reply, accepted: true, delivery: 'guided_fallback' });
  } else if (value.status === 'unknown' && unknownReasons.has(value.reason)) {
    const reply = providerReply ? Object.freeze({ ...preparedReply, sources: Object.freeze([]) }) : preparedReply;
    expected = createConversationOutcome('unknown', { reply, accepted: true, delivery: 'unknown', reason: value.reason });
  } else if (['busy', 'conflict', 'limit', 'cancelled', 'closed', 'not_found'].includes(value.status)) {
    expected = createConversationOutcome(value.status);
  } else return false;
  return JSON.stringify(value) === JSON.stringify(createHttpResult(request, expected));
}

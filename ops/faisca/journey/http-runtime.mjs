import { createJourney, respondJourney } from './state.mjs';

/**
 * Trusted HTTP host factory. One volatile R07 state belongs to one server-issued
 * session. The request body cannot choose or replace this policy.
 */
export function createJourneyPrepareTurn(conversationId) {
  if (typeof conversationId !== 'string' || !/^[a-f0-9]{32}$/.test(conversationId)) {
    throw new TypeError('A server-issued conversation ID is required.');
  }
  let journey = createJourney();
  return (_runtimeSession, input) => {
    const result = respondJourney(journey, input);
    journey = result.session;
    return result;
  };
}

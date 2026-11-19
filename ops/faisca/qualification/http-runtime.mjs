import { createQualificationJourney, respondQualificationJourney } from './journey.mjs';

/** One trusted R08 state closure per server-issued HTTP conversation. */
export function createQualificationPrepareTurn(conversationId) {
  if (typeof conversationId !== 'string' || !/^[a-f0-9]{32}$/.test(conversationId)) {
    throw new TypeError('A server-issued conversation ID is required.');
  }
  let journey = createQualificationJourney();
  return (_runtimeSession, input) => {
    const result = respondQualificationJourney(journey, input);
    journey = result.session;
    return result;
  };
}

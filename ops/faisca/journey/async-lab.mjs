import { createConversationRuntime } from '../conversation-runtime.mjs';
import { validateConversationRequest } from '../conversation-contract.mjs';
import { createSimulatedProvider } from '../simulated-provider.mjs';
import { findGroundedAnswer } from '../grounding/guide.mjs';
import { createJourney, getJourneySummary, respondJourney } from './state.mjs';

/**
 * R07 opt-in lab: reuses the R03 in-memory deduplication and reconciliation
 * runtime with the R07 confirmed-choice policy. The HTTP/CRM/Agents production
 * boundary is intentionally not exposed here.
 */
export function createAsyncJourneyLab({ conversationId, timeoutMs = 25,
  createProvider = () => createSimulatedProvider({ scenario: 'success', delayMs: 0 }) } = {}) {
  if (typeof conversationId !== 'string' || !/^[A-Za-z0-9_-]{8,96}$/.test(conversationId) ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000 ||
      typeof createProvider !== 'function') throw new TypeError('Invalid R07 laboratory host configuration.');

  let journey = createJourney();
  let closed = false;
  let epoch = 0;
  const awaitingReconciliation = new Set();
  let runtime;

  function newRuntime() {
    // A fresh provider is owned by each runtime generation. Destroying a
    // generation cannot settle or dispatch a new generation's message.
    const provider = createProvider();
    return createConversationRuntime({
      provider, timeoutMs,
      prepareTurn(_ignoredLegacySession, input) {
        const result = respondJourney(journey, input);
        // Only verified editorial answers enter this asynchronous channel.
        if (!findGroundedAnswer(result.reply)) throw new Error('Non-grounded asynchronous turn.');
        journey = result.session;
        return result;
      }
    });
  }
  runtime = newRuntime();

  function local(input) {
    if (closed || runtime.inspect().pending || awaitingReconciliation.size) return Object.freeze({ status: closed ? 'closed' : 'busy' });
    const result = respondJourney(journey, input);
    // This local route is exclusively for proposing or confirming a goal.
    // Other requests must use the correlated, deduplicated async route.
    if (!['journey_confirmation_needed', 'journey_cancelled', 'journey_no_pending',
      'journey_confirmation_refused', 'goal_presence', 'goal_campaign', 'goal_ads',
      'goal_sales', 'channel_google', 'channel_meta'].includes(result.reply.intent)) {
      return Object.freeze({ status: 'use_correlated_send' });
    }
    journey = result.session;
    return Object.freeze({ status: 'local', session: journey, reply: result.reply });
  }

  function checked(request) {
    const validated = validateConversationRequest(request);
    return validated?.conversationId === conversationId ? validated : null;
  }

  async function send(request) {
    if (closed) return Object.freeze({ status: 'closed' });
    const safe = checked(request);
    if (!safe) return Object.freeze({ status: 'invalid_request' });
    if (awaitingReconciliation.size && !awaitingReconciliation.has(safe.messageId)) {
      return Object.freeze({ status: 'busy', reason: 'awaiting_reconciliation' });
    }
    // Pure preview only. No pre-dispatch selection, no provider call for
    // proposals, and no action with an unsupported model response.
    const preview = respondJourney(journey, safe.input);
    if (!findGroundedAnswer(preview.reply)) {
      return Object.freeze({ status: 'local_only', reason: preview.reply.intent });
    }
    const ownEpoch = epoch;
    const receipt = await runtime.send(safe);
    if (ownEpoch === epoch && !closed && receipt.status === 'unknown') {
      awaitingReconciliation.add(safe.messageId);
    }
    return receipt;
  }

  async function reconcile(request) {
    if (closed) return Object.freeze({ status: 'closed' });
    const safe = checked(request);
    if (!safe) return Object.freeze({ status: 'invalid_request' });
    const ownEpoch = epoch;
    const receipt = await runtime.reconcile(safe);
    if (ownEpoch === epoch && !closed && receipt.status !== 'unknown' &&
        awaitingReconciliation.has(safe.messageId)) awaitingReconciliation.delete(safe.messageId);
    return receipt;
  }

  function reset() {
    if (closed) return false;
    const old = runtime;
    old.destroy();
    journey = createJourney();
    epoch++;
    awaitingReconciliation.clear();
    runtime = newRuntime();
    return true;
  }

  function destroy() {
    if (closed) return;
    closed = true;
    runtime.destroy();
    awaitingReconciliation.clear();
    journey = createJourney();
  }

  function inspect() {
    const engine = runtime.inspect();
    return Object.freeze({
      mode: 'r07_async_synthetic_lab', generation: epoch, closed,
      dispatched: engine.dispatched, pending: engine.pending, unknown: engine.unknown,
      awaitingReconciliation: awaitingReconciliation.size,
      summary: closed ? null : getJourneySummary(journey),
      confirmedSelections: Object.freeze(closed ? [] : [...journey.coreSession.selection]),
      pendingGoal: closed ? null : journey.pendingGoal
    });
  }

  return Object.freeze({ local, send, reconcile, reset, destroy, inspect });
}

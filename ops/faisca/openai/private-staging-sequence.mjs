import { inspectFaiscaPrivateNegativeConversation } from './private-staging-negative-probe.mjs';
import { inspectFaiscaPrivatePositiveConversation } from './private-staging-positive-probe.mjs';

export const FAISCA_PRIVATE_SEQUENCE_SCHEMA = 'faisca.private-staging-conversation-sequence.v1';
const LOOPBACK = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/u;
const TOKEN = /^[A-Za-z0-9_-]{32,128}$/u;

function report(status, negative, positive) {
  return Object.freeze({
    schema: FAISCA_PRIVATE_SEQUENCE_SCHEMA,
    status,
    // Counts are observable HTTP dispatch attempts, not provider usage.
    assetRequests: (negative?.assetRequests ?? 0) + (positive?.assetRequests ?? 0),
    apiRequests: (negative?.apiRequests ?? 0) + (positive?.apiRequests ?? 0),
    negativeInputRejected: negative?.status === 'PRIVATE_NEGATIVE_CONVERSATION_VERIFIED',
    positiveEnvelopeAccepted: positive?.status === 'PRIVATE_POSITIVE_ENVELOPE_VERIFIED',
    // Even two successful HTTP results cannot attest upstream model invocations.
    modelCallsProvenZeroForNegative: false,
    modelCallsProvenExactlyTwoForPositive: false,
    providerTransportVerified: false,
    ledgerReconciled: false,
    publicReady: false,
    operationalEffects: false
  });
}

/**
 * R157: a *single* operator gate for the two already-reviewed R154/R155
 * synthetic probes. Never send the positive question when the negative
 * privacy preflight fails. Each probe independently checks exact UI assets.
 *
 * With a real private adapter this can generate up to two paid model calls
 * on the positive path; execution is gated by a separate operator CLI.
 * No retries, caller-supplied question, provider key, production endpoint
 * or evidence of public readiness.
 */
export async function inspectFaiscaPrivateConversationSequence({
  origin = 'http://127.0.0.1:4336',
  reviewToken,
  enabled = false,
  fetchImpl = globalThis.fetch,
  negativeTimeoutMs = 3000,
  positiveTimeoutMs = 30000
} = {}) {
  const match = typeof origin === 'string' ? LOOPBACK.exec(origin) : null;
  if (!match || Number(match[1]) > 65535 || enabled !== true ||
      typeof reviewToken !== 'string' || !TOKEN.test(reviewToken) ||
      typeof fetchImpl !== 'function' ||
      !Number.isInteger(negativeTimeoutMs) ||
      negativeTimeoutMs < 50 || negativeTimeoutMs > 3000 ||
      !Number.isInteger(positiveTimeoutMs) ||
      positiveTimeoutMs < 50 || positiveTimeoutMs > 35000) {
    return report('BLOCKED_INVALID_PRIVATE_CONFIGURATION');
  }

  let negative;
  try {
    negative = await inspectFaiscaPrivateNegativeConversation({
      origin, reviewToken, enabled: true, fetchImpl,
      timeoutMs: negativeTimeoutMs
    });
  } catch {
    return report('BLOCKED_NEGATIVE_GATE');
  }
  if (negative?.status !== 'PRIVATE_NEGATIVE_CONVERSATION_VERIFIED' ||
      negative.assetRequests !== 4 || negative.apiRequests !== 1 ||
      negative.negativeInputRejected !== true ||
      negative.publicReady !== false || negative.operationalEffects !== false) {
    return report('BLOCKED_NEGATIVE_GATE', negative);
  }

  let positive;
  try {
    positive = await inspectFaiscaPrivatePositiveConversation({
      origin, reviewToken, enabled: true, fetchImpl,
      timeoutMs: positiveTimeoutMs
    });
  } catch {
    return report('BLOCKED_POSITIVE_GATE', negative);
  }
  if (positive?.status !== 'PRIVATE_POSITIVE_ENVELOPE_VERIFIED' ||
      positive.assetRequests !== 4 || positive.apiRequests !== 1 ||
      positive.positiveEnvelopeAccepted !== true ||
      positive.publicReady !== false || positive.operationalEffects !== false) {
    return report('BLOCKED_POSITIVE_GATE', negative, positive);
  }
  return report('PRIVATE_SYNTHETIC_SEQUENCE_ENVELOPES_VERIFIED', negative, positive);
}

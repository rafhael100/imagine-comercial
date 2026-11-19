export const SYNTHETIC_QUOTA_SCHEMA = 'faisca.synthetic-route-quota.v1';
const PRIVATE_STATE = new WeakMap();
const SESSION_ID = /^[A-Za-z0-9._-]{1,64}$/;

function settings(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(input))) return null;
    const names = Reflect.ownKeys(input);
    if (names.length !== 2 || names.some(name =>
        typeof name !== 'string' || !['maxTotal', 'maxPerConversation'].includes(name))) return null;
    const desc = Object.getOwnPropertyDescriptors(input);
    if (!Object.hasOwn(desc.maxTotal, 'value') ||
        !Object.hasOwn(desc.maxPerConversation, 'value')) return null;
    const { value: maxTotal } = desc.maxTotal;
    const { value: maxPerConversation } = desc.maxPerConversation;
    if (!Number.isInteger(maxTotal) || maxTotal < 1 || maxTotal > 256 ||
        !Number.isInteger(maxPerConversation) || maxPerConversation < 1 ||
        maxPerConversation > 64 || maxPerConversation > maxTotal) return null;
    return { maxTotal, maxPerConversation };
  } catch { return null; }
}

/**
 * An in-memory, synthetic-only invocation quota for the R09 route fixture.
 * Counts actual provider dispatches rather than user turns or fixed safety
 * replies. These units are NOT currency, tokens, verified billing or a
 * durable rate limit across workers. A real model is still prohibited.
 */
export function createSyntheticRouteQuota(options = {
  maxTotal: 8, maxPerConversation: 3
}) {
  const policy = settings(options);
  if (!policy) throw new TypeError('A bounded, trusted simulated quota policy is required.');
  const state = {
    policy, totalReserved: 0, rejected: 0, perConversation: new Map()
  };
  const quota = Object.freeze({
    schema: SYNTHETIC_QUOTA_SCHEMA,
    inspect() {
      return Object.freeze({
        schema: SYNTHETIC_QUOTA_SCHEMA,
        maxTotal: policy.maxTotal,
        maxPerConversation: policy.maxPerConversation,
        totalReserved: state.totalReserved,
        rejected: state.rejected,
        conversations: state.perConversation.size,
        moneySpent: false,
        externalModelInvocations: 0
      });
    }
  });
  PRIVATE_STATE.set(quota, state);
  return quota;
}

export function isSyntheticRouteQuota(candidate) {
  return candidate !== null &&
    (typeof candidate === 'object' || typeof candidate === 'function') &&
    PRIVATE_STATE.has(candidate);
}

/** A denied reservation never triggers a provider call or a free retry. */
export function reserveSyntheticRouteInvocation(quota, conversationId) {
  const state = isSyntheticRouteQuota(quota) ? PRIVATE_STATE.get(quota) : null;
  if (!state || typeof conversationId !== 'string' || !SESSION_ID.test(conversationId)) {
    return false;
  }
  const current = state.perConversation.get(conversationId) ?? 0;
  if (state.totalReserved >= state.policy.maxTotal ||
      current >= state.policy.maxPerConversation) {
    state.rejected++;
    return false;
  }
  state.totalReserved++;
  state.perConversation.set(conversationId, current + 1);
  return true;
}

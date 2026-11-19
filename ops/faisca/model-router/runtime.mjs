import { createHash } from 'node:crypto';
import { isSyntheticRouteQuota, reserveSyntheticRouteInvocation } from './synthetic-quota.mjs';
import {
  prepareModelRouteRequest, retrieveCandidateAnswerIds, verifyModelRouteResponse,
  localModelRouteFixture, ROUTER_RESPONSE_SCHEMA, ROUTER_CLARIFICATION_IDS,
  getAnonymousRouteBoundary
} from './contract.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function plainInput(value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 3 || keys.some(key => !['conversationId', 'messageId', 'userText'].includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (keys.some(key => !Object.hasOwn(descriptors[key], 'value'))) return null;
    const conversationId = descriptors.conversationId.value;
    const messageId = descriptors.messageId.value;
    const userText = descriptors.userText.value;
    if (typeof conversationId !== 'string' || !ID_PATTERN.test(conversationId) ||
        typeof messageId !== 'string' || !ID_PATTERN.test(messageId) ||
        typeof userText !== 'string' || userText.length < 1 || userText.length > 800) return null;
    return Object.freeze({ conversationId, messageId, userText });
  } catch { return null; }
}

function fixedFallback(request) {
  return verifyModelRouteResponse(request, {
    schema: ROUTER_RESPONSE_SCHEMA, invocationId: request.invocationId,
    messageId: request.messageId, routeStatus: 'unsupported',
    answerId: null, clarificationId: null
  });
}

function result(status, route, { delivery = 'none', accepted = false, reason = status } = {}) {
  return Object.freeze({
    status, delivery, accepted, reason, route,
    externalModelInvocations: 0,
    operationalEffects: false
  });
}

/**
 * Volatile, simulated-only route runtime. It provides idempotency, one active
 * request per conversation, timeout reconciliation and reset semantics.
 * A real provider is intentionally not accepted in this phase.
 */
export function createModelRouteRuntime({ provider, timeoutMs = 250, maxEntries = 64, quota } = {}) {
  if (!provider || provider.kind !== 'simulated' || typeof provider.route !== 'function' ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000 ||
      !Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 256 ||
      (quota !== undefined && !isSyntheticRouteQuota(quota))) {
    throw new TypeError('Only a bounded simulated R09 provider is allowed.');
  }
  const entries = new Map();
  const conversations = new Map();
  let live = true;
  let dispatched = 0;
  let completed = 0;
  let failed = 0;
  let pending = 0;

  function settle(entry, value) {
    if (!live || entry.final) return;
    entry.final = value;
    // Local fixed replies never reserved a provider slot. Do not decrement
    // the counter of a different conversation turn still waiting on a provider.
    if (entry.pending) pending = Math.max(0, pending - 1);
    entry.pending = false;
    clearTimeout(entry.timer);
    const state = conversations.get(entry.conversationId);
    if (state?.active === entry) state.active = null;
    if (!entry.initial) {
      entry.initial = value;
      entry.resolve(value);
    }
    completed++;
  }

  function markUnknown(entry, reason) {
    if (!live || entry.initial || entry.final) return;
    entry.initial = result('unknown', null, {
      delivery: 'unknown', accepted: true, reason
    });
    clearTimeout(entry.timer);
    entry.resolve(entry.initial);
    // Keep the entry active until its original provider promise settles or the
    // runtime is destroyed. Replaying the same ID never dispatches a second call.
  }

  function buildRequest(rawInput) {
    const input = plainInput(rawInput);
    if (!input) return null;
    const boundary = getAnonymousRouteBoundary(input.userText);
    if (boundary) return Object.freeze({
      input, request: null, boundary,
      fingerprint: sha(JSON.stringify([
        'faisca.host.boundary.v1', input.conversationId, input.messageId, input.userText
      ]))
    });
    const candidateAnswerIds = retrieveCandidateAnswerIds(input.userText);
    const request = prepareModelRouteRequest({
      ...input, candidateAnswerIds,
      allowedClarificationIds: ROUTER_CLARIFICATION_IDS
    });
    return request ? Object.freeze({ input, request, fingerprint: sha(JSON.stringify(request)) }) : null;
  }

  async function send(rawInput) {
    if (!live) return result('closed', null);
    const prepared = buildRequest(rawInput);
    if (!prepared) return result('invalid_request', null, { reason: 'preflight_or_schema_refused' });
    const { input, request, fingerprint, boundary } = prepared;
    const key = JSON.stringify([input.conversationId, input.messageId]);
    const previous = entries.get(key);
    if (previous) {
      if (previous.fingerprint !== fingerprint) return result('conflict', null);
      return previous.initial || previous.promise;
    }
    if (entries.size >= maxEntries) return result('limit', null);
    const state = conversations.get(input.conversationId) || { active: null };
    // A host-fixed privacy boundary must be available even while an unrelated
    // editorial request is pending; it dispatches neither provider nor PHP.
    if (state.active?.pending && !boundary) return result('busy', null, { reason: 'previous_route_unresolved' });
    let resolve;
    const promise = new Promise(yes => { resolve = yes; });
    const entry = {
      key, fingerprint, request, conversationId: input.conversationId,
      promise, resolve, initial: null, final: null, pending: false, timer: null
    };
    entries.set(key, entry);
    conversations.set(input.conversationId, state);

    if (boundary) {
      settle(entry, result('answered', boundary, {
        delivery: 'fixed_boundary', accepted: true, reason: 'anonymous_operational_boundary'
      }));
      return entry.initial;
    }

    // No matching editorial candidate means the host can answer locally. The
    // question is not sent to a provider merely to receive an unsupported result.
    if (request.candidateAnswers.length === 0) {
      const fallback = fixedFallback(request);
      settle(entry, result('answered', fallback, {
        delivery: 'fixed_fallback', accepted: true, reason: 'no_editorial_candidate'
      }));
      return entry.initial;
    }

    // Optional laboratory-only admission. Fixed anonymous boundaries and
    // questions without a reviewed editorial candidate consume no quota.
    // Reserve before a provider dispatch; do NOT refund on timeout, failure
    // or destroy because a future paid provider may have already worked.
    if (quota && !reserveSyntheticRouteInvocation(quota, input.conversationId)) {
      settle(entry, result('limit', null, {
        delivery: 'none', accepted: false, reason: 'synthetic_quota_exhausted'
      }));
      return entry.initial;
    }

    entry.pending = true;
    state.active = entry;
    pending++;
    entry.timer = setTimeout(() => markUnknown(entry, 'timeout_after_dispatch'), timeoutMs);
    dispatched++;
    let work;
    try { work = provider.route(request); }
    catch { work = Promise.reject(new Error('simulated_provider_failure')); }
    Promise.resolve(work).then(candidate => {
      if (!live) return;
      const verified = verifyModelRouteResponse(request, candidate);
      if (verified.accepted) {
        settle(entry, result('answered', verified, {
          delivery: 'simulated', accepted: true, reason: 'verified_route'
        }));
      } else {
        failed++;
        settle(entry, result('invalid_response', fixedFallback(request), {
          delivery: 'fixed_fallback', accepted: true, reason: 'model_route_unverified'
        }));
      }
    }, () => {
      if (!live) return;
      failed++;
      settle(entry, result('unavailable', fixedFallback(request), {
        delivery: 'fixed_fallback', accepted: true, reason: 'provider_unavailable'
      }));
    });
    return promise;
  }

  async function reconcile(rawInput) {
    if (!live) return result('closed', null);
    const prepared = buildRequest(rawInput);
    if (!prepared) return result('invalid_request', null);
    const { input, fingerprint } = prepared;
    const entry = entries.get(JSON.stringify([input.conversationId, input.messageId]));
    if (!entry) return result('not_found', null);
    if (entry.fingerprint !== fingerprint) return result('conflict', null);
    if (entry.final) return entry.final;
    return entry.initial || result('unknown', null, {
      delivery: 'unknown', accepted: true, reason: 'pending'
    });
  }

  function destroy() {
    if (!live) return;
    live = false;
    for (const entry of entries.values()) {
      clearTimeout(entry.timer);
      if (!entry.initial) entry.resolve(result('closed', null));
      entry.pending = false;
    }
    pending = 0;
    conversations.clear();
  }

  function inspect() {
    return Object.freeze({
      live, entries: entries.size, conversations: conversations.size,
      dispatched, completed, failed, pending, externalModelInvocations: 0
    });
  }

  return Object.freeze({ send, reconcile, destroy, inspect });
}

/** Test/demo provider only; never performs an external model request. */
export function createLocalModelRouteProvider({ scenario = 'success', delayMs = 0 } = {}) {
  if (!['success', 'clarify', 'unsupported', 'wrong_topic', 'stale_invocation',
    'invented_text', 'tool_request', 'unavailable'].includes(scenario) ||
      !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 2000) {
    throw new TypeError('Invalid local R09 fixture configuration.');
  }
  return Object.freeze({
    kind: 'simulated',
    route(request) {
      const work = () => {
        if (scenario === 'unavailable') throw new Error('simulated_provider_unavailable');
        return localModelRouteFixture(request, scenario);
      };
      return delayMs ? new Promise(resolve => setTimeout(() => {
        try { resolve(work()); } catch (error) { resolve(Promise.reject(error)); }
      }, delayMs)) : Promise.resolve().then(work);
    }
  });
}

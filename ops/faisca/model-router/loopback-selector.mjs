import {
  buildCandidateOnlyRouteEgress, ROUTER_RESPONSE_SCHEMA
} from './contract.mjs';
import {
  MAX_CANDIDATE_DECISION_BYTES, serializeCandidateOnlyWireRequest,
  parseCandidateOnlyWireDecision
} from './candidate-wire.mjs';

export const LOOPBACK_SELECTOR_PROVIDER_SCHEMA = 'faisca.candidate-only-loopback.v1';
const endpointPattern = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/candidate-only$/;

function checkedConfig(config) {
  try {
    if (!config || typeof config !== 'object' || Array.isArray(config) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(config))) return null;
    const names = Reflect.ownKeys(config);
    if (names.length < 1 || names.length > 2 ||
        names.some(name => typeof name !== 'string' ||
          !['endpoint', 'timeoutMs'].includes(name)) || !names.includes('endpoint')) return null;
    const desc = Object.getOwnPropertyDescriptors(config);
    if (names.some(name => !Object.hasOwn(desc[name], 'value'))) return null;
    const endpoint = desc.endpoint.value;
    const match = typeof endpoint === 'string' ? endpointPattern.exec(endpoint) : null;
    if (!match || Number(match[1]) > 65535) return null;
    // The HTTP fixture is *only* a real loopback listener. Never resolve a
    // DNS name, follow a redirect or accept query strings or credentials.
    const timeoutMs = names.includes('timeoutMs') ? desc.timeoutMs.value : 800;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 3000) return null;
    return Object.freeze({ endpoint, timeoutMs });
  } catch { return null; }
}

async function readBoundedJson(response, signal) {
  if (response.status !== 200 ||
      !/^application\/json(?:;\s*charset=utf-8)?$/i.test(response.headers.get('content-type') ?? '') ||
      !response.body) throw new Error('R57: invalid selector response envelope.');
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_CANDIDATE_DECISION_BYTES)) {
    throw new Error('R57: selector response exceeds the bounded contract.');
  }
  const reader = response.body.getReader();
  const parts = [];
  let total = 0;
  try {
    while (true) {
      if (signal.aborted) throw new Error('R57: selector fixture deadline exceeded.');
      const result = await reader.read();
      if (result.done) break;
      const bytes = result.value;
      total += bytes.byteLength;
      if (total > MAX_CANDIDATE_DECISION_BYTES) throw new Error('R57: selector response exceeds the bounded contract.');
      parts.push(bytes);
    }
  } finally {
    try { await reader.cancel(); } catch { /* No data is trusted on an incomplete read. */ }
  }
  if (total < 2) throw new Error('R57: empty selector response.');
  return new TextDecoder('utf-8', { fatal: true }).decode(
    Buffer.concat(parts.map(part => Buffer.from(part))));
}

/**
 * R57: exercise the R49 candidate-only wire through actual local HTTP.
 *
 * This provider CANNOT address an external model or non-loopback hostname,
 * supplies no secrets/auth, refuses redirects and never transmits userText,
 * conversationId, messageId, email, phone, CRM or Portal context. The remote
 * listener is a TEST FIXTURE, never a model. All decisions are verified by the
 * trusted host's R48/R49 closed-selection contract before correlation.
 *
 * This is not a production connector or a pricing/billing quota.
 */
export function createCandidateOnlyLoopbackRouteProvider(config) {
  const settings = checkedConfig(config);
  if (!settings) throw new TypeError('R57 requires an exact local candidate-only fixture endpoint.');
  return Object.freeze({
    schema: LOOPBACK_SELECTOR_PROVIDER_SCHEMA,
    kind: 'simulated',
    async route(request) {
      const egress = buildCandidateOnlyRouteEgress(request);
      const wire = serializeCandidateOnlyWireRequest(egress);
      if (!wire) throw new Error('R57: trusted candidate envelope required.');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), settings.timeoutMs);
      try {
        const response = await fetch(settings.endpoint, {
          method: 'POST', body: wire.body, signal: controller.signal,
          redirect: 'error', credentials: 'omit', cache: 'no-store',
          referrerPolicy: 'no-referrer',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
        });
        const body = await readBoundedJson(response, controller.signal);
        const choice = parseCandidateOnlyWireDecision(body, egress);
        if (!choice) throw new Error('R57: unverified candidate-only response.');
        return Object.freeze({
          schema: ROUTER_RESPONSE_SCHEMA,
          invocationId: request.invocationId,
          messageId: request.messageId,
          routeStatus: choice.routeStatus,
          answerId: choice.answerId,
          clarificationId: choice.clarificationId
        });
      } catch {
        // Never surface raw HTTP error bodies, addresses or provider details.
        throw new Error('R57: local candidate selector unavailable or unverified.');
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
    }
  });
}

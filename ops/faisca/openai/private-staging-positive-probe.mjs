import { inspectFaiscaPrivateReviewUi } from './private-staging-readonly-smoke.mjs';
import { safePrivateGeneralReply } from './private-conversation-policy.mjs';
import { hasPrivateIdentifierRisk } from './private-identifier-risk.mjs';

export const FAISCA_PRIVATE_POSITIVE_PROBE_SCHEMA =
  'faisca.private-staging-positive-conversation-probe.v1';
const PATH = '/__faisca_openai_private/converse';
// Fixed fictional question from the already-reviewed R95 integration fixture.
// It contains no visitor, company or customer identifiers.
const QUESTION = 'Vale a pena usar uma landing page para divulgar um evento?';
const TOKEN = /^[A-Za-z0-9_-]{32,128}$/u;
const LOOPBACK = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/u;
const MAX_RESPONSE_BYTES = 4096;
const EXPECTED_KEYS = Object.freeze([
  'schema', 'status', 'answer', 'sources', 'models', 'sourceRecipeBound',
  'requiresEditorialReview', 'publicReady', 'operationalEffects'
]);

function report(status, assetRequests = 0, apiRequests = 0) {
  return Object.freeze({
    schema: FAISCA_PRIVATE_POSITIVE_PROBE_SCHEMA, status,
    assetRequests, apiRequests,
    positiveEnvelopeAccepted: status === 'PRIVATE_POSITIVE_ENVELOPE_VERIFIED',
    // A model ID in an HTTP response is an assertion, NOT independently
    // verified provider accounting or evidence of a paid API call.
    modelCallsProvenExactlyTwo: false,
    providerTransportVerified: false,
    publicReady: false, operationalEffects: false
  });
}

function reviewedPositiveEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      Reflect.ownKeys(value).length !== EXPECTED_KEYS.length ||
      !EXPECTED_KEYS.every(key => Object.hasOwn(value, key))) return false;
  if (value.schema !== 'faisca.openai-private-conversation-response.v1' ||
      value.status !== 'general_answer' ||
      typeof value.answer !== 'string' || value.answer.length < 20 ||
      value.answer.length > 900 ||
      !safePrivateGeneralReply(value.answer) ||
      hasPrivateIdentifierRisk(value.answer) ||
      /[\u0000-\u001f\u007f<>]/u.test(value.answer) ||
      value.sourceRecipeBound !== false ||
      value.requiresEditorialReview !== true ||
      value.publicReady !== false || value.operationalEffects !== false) return false;
  return Array.isArray(value.sources) && value.sources.length === 0 &&
    Array.isArray(value.models) && value.models.length === 2 &&
    value.models[0] === 'gpt-6-luna' && value.models[1] === 'gpt-6.1-terra';
}

async function readBoundedJson(response, signal) {
  if (!response.body) throw Error('missing body');
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  const readWithAbort = pending => {
    if (signal.aborted) return Promise.reject(Error('timeout'));
    let listener;
    const cancelled = new Promise((_, reject) => {
      listener = () => reject(Error('timeout'));
      signal.addEventListener('abort', listener, { once: true });
    });
    return Promise.race([pending, cancelled]).finally(() =>
      signal.removeEventListener('abort', listener));
  };
  try {
    for (;;) {
      const part = await readWithAbort(reader.read());
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_RESPONSE_BYTES) throw Error('oversized');
      chunks.push(part.value);
    }
    const buffer = Buffer.concat(chunks.map(part => Buffer.from(part)));
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
  } finally {
    // Do not await an uncooperative stream's cancel() after a deadline.
    try { void Promise.resolve(reader.cancel()).catch(() => {}); }
    catch { /* Fail closed. */ }
  }
}

/**
 * R155 positive complement to R154's negative HTTP staging gate.
 * Confirm exact private browser assets before ONE fixed fictional POST.
 * No retry, real input, output text persistence, provider key, or public action.
 *
 * A 200 envelope with declared Luna/Terra IDs still cannot prove that the
 * backend called either model: reconcile provider/ledger evidence separately.
 */
export async function inspectFaiscaPrivatePositiveConversation({
  origin = 'http://127.0.0.1:4336',
  reviewToken, enabled = false,
  fetchImpl = globalThis.fetch,
  verifyPrivateUi = inspectFaiscaPrivateReviewUi,
  timeoutMs = 30000
} = {}) {
  const match = typeof origin === 'string' ? LOOPBACK.exec(origin) : null;
  if (!match || Number(match[1]) > 65535 || enabled !== true ||
      typeof reviewToken !== 'string' || !TOKEN.test(reviewToken) ||
      typeof fetchImpl !== 'function' || typeof verifyPrivateUi !== 'function' ||
      !Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 35000) {
    return report('BLOCKED_INVALID_PRIVATE_CONFIGURATION');
  }
  let assets;
  try {
    assets = await verifyPrivateUi({
      origin, fetchImpl, privateConversationEnabled: true,
      timeoutMs: Math.min(timeoutMs, 3000)
    });
  } catch {
    return report('BLOCKED_PRIVATE_UI_NOT_VERIFIED');
  }
  const assetRequests = Number.isInteger(assets?.requests) ? assets.requests : 0;
  if (assets?.status !== 'PRIVATE_UI_READONLY_VERIFIED' ||
      assets.requests !== 4 || assets.publicReady !== false ||
      !Array.isArray(assets.checks) || assets.checks.length !== 4 ||
      !assets.checks.every(entry => entry?.passed === true)) {
    return report('BLOCKED_PRIVATE_UI_NOT_VERIFIED', assetRequests);
  }

  let apiRequests = 0, onAbort;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const deadline = new Promise((_, reject) => {
      onAbort = () => reject(Error('deadline'));
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    apiRequests++;
    const response = await Promise.race([
      fetchImpl(origin + PATH, {
        method: 'POST', body: JSON.stringify([true, QUESTION]),
        signal: controller.signal, redirect: 'error', credentials: 'omit',
        cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: {
          'Authorization': 'Bearer ' + reviewToken,
          'Content-Type': 'application/json'
        }
      }),
      deadline
    ]);
    const h = response.headers;
    const contentLength = h.get('content-length');
    if (response.status !== 200 || response.redirected === true ||
        h.get('content-type') !== 'application/json; charset=utf-8' ||
        h.get('cache-control') !== 'no-store, max-age=0' ||
        h.get('x-content-type-options') !== 'nosniff' ||
        h.get('x-robots-tag') !== 'noindex, nofollow, noarchive' ||
        h.get('set-cookie') !== null ||
        h.get('access-control-allow-origin') !== null ||
        h.get('access-control-allow-credentials') !== null ||
        (contentLength !== null &&
          (!/^[0-9]+$/u.test(contentLength) ||
          Number(contentLength) > MAX_RESPONSE_BYTES))) {
      return report('BLOCKED_PRIVATE_POSITIVE_CONVERSATION', assetRequests, apiRequests);
    }
    const body = await Promise.race([readBoundedJson(response, controller.signal), deadline]);
    return report(reviewedPositiveEnvelope(body)
      ? 'PRIVATE_POSITIVE_ENVELOPE_VERIFIED'
      : 'BLOCKED_PRIVATE_POSITIVE_CONVERSATION', assetRequests, apiRequests);
  } catch {
    return report('BLOCKED_PRIVATE_POSITIVE_CONVERSATION', assetRequests, apiRequests);
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (onAbort) controller.signal.removeEventListener('abort', onAbort);
  }
}

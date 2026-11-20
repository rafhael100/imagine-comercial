import { inspectFaiscaPrivateReviewUi } from './private-staging-readonly-smoke.mjs';

export const FAISCA_PRIVATE_NEGATIVE_PROBE_SCHEMA =
  'faisca.private-staging-negative-conversation-probe.v1';
const PATH = '/__faisca_openai_private/converse';
const QUESTION = 'Como explicar cGVzc29hQGV4ZW1wbG8uaW52YWxpZA== numa landing page fictícia?';
const TOKEN = /^[A-Za-z0-9_-]{32,128}$/u;
const LOOPBACK = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/u;

function report(status, assetRequests = 0, apiRequests = 0) {
  // No request content, authorization value, response body, personal data or
  // key material is ever included in a report, failure or success.
  return Object.freeze({
    schema: FAISCA_PRIVATE_NEGATIVE_PROBE_SCHEMA, status,
    assetRequests, apiRequests,
    negativeInputRejected: status === 'PRIVATE_NEGATIVE_CONVERSATION_VERIFIED',
    modelCallsProvenZero: false,
    publicReady: false, operationalEffects: false
  });
}

/**
 * R154: one negative, strictly synthetic POST against an already-running
 * loopback operator server. First require exact R153 UI, JS, CSS, mascot and
 * private security headers using the independent GET-only smoke.
 *
 * A 400 response is evidence of HTTP preflight rejection, not proof that a
 * misconfigured backend made zero calls. Never use this to open public access.
 */
export async function inspectFaiscaPrivateNegativeConversation({
  origin = 'http://127.0.0.1:4336',
  reviewToken,
  enabled = false,
  fetchImpl = globalThis.fetch,
  verifyPrivateUi = inspectFaiscaPrivateReviewUi,
  timeoutMs = 3000
} = {}) {
  const match = typeof origin === 'string' ? LOOPBACK.exec(origin) : null;
  if (!match || Number(match[1]) > 65535 ||
      enabled !== true || typeof reviewToken !== 'string' ||
      !TOKEN.test(reviewToken) || typeof fetchImpl !== 'function' ||
      typeof verifyPrivateUi !== 'function' ||
      !Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 3000) {
    return report('BLOCKED_INVALID_PRIVATE_CONFIGURATION');
  }

  let assets;
  try {
    assets = await verifyPrivateUi({
      origin, fetchImpl, privateConversationEnabled: true, timeoutMs
    });
  } catch {
    return report('BLOCKED_PRIVATE_UI_NOT_VERIFIED');
  }
  const getRequests = Number.isInteger(assets?.requests) ? assets.requests : 0;
  if (assets?.status !== 'PRIVATE_UI_READONLY_VERIFIED' ||
      assets.requests !== 4 || assets.publicReady !== false) {
    return report('BLOCKED_PRIVATE_UI_NOT_VERIFIED', getRequests);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let onAbort, apiRequests = 0;
  try {
    const deadline = new Promise((_, reject) => {
      onAbort = () => reject(Error('deadline'));
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    const body = JSON.stringify([true, QUESTION]);
    // No caller-supplied or real customer text enters this request. No retry.
    apiRequests++;
    const response = await Promise.race([
      fetchImpl(origin + PATH, {
        method: 'POST', body, signal: controller.signal,
        redirect: 'error', credentials: 'omit', cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: {
          'Authorization': 'Bearer ' + reviewToken,
          'Content-Type': 'application/json'
        }
      }),
      deadline
    ]);
    const headers = response.headers;
    const passed = response.status === 400 && response.redirected !== true &&
      headers.get('content-type') === 'application/json; charset=utf-8' &&
      headers.get('cache-control') === 'no-store, max-age=0' &&
      headers.get('x-content-type-options') === 'nosniff' &&
      headers.get('x-robots-tag') === 'noindex, nofollow, noarchive' &&
      headers.get('set-cookie') === null &&
      headers.get('access-control-allow-origin') === null &&
      headers.get('access-control-allow-credentials') === null;
    // Do not read or print a response body even when the server is modified.
    try { void Promise.resolve(response.body?.cancel()).catch(() => {}); }
    catch { /* An uncooperative stream must not hang the gate. */ }
    return report(passed ? 'PRIVATE_NEGATIVE_CONVERSATION_VERIFIED' :
      'BLOCKED_PRIVATE_NEGATIVE_CONVERSATION', getRequests, apiRequests);
  } catch {
    return report('BLOCKED_PRIVATE_NEGATIVE_CONVERSATION', getRequests, apiRequests);
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (onAbort) controller.signal.removeEventListener('abort', onAbort);
  }
}

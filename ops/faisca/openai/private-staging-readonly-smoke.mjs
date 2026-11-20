import {
  PRIVATE_REVIEW_HTML, PRIVATE_REVIEW_CONVERSATION_HTML, PRIVATE_REVIEW_JS, PRIVATE_REVIEW_CSS
} from './private-review-page.mjs';

export const FAISCA_PRIVATE_STAGING_SMOKE_SCHEMA = 'faisca.private-staging-readonly-smoke.v1';
// Independent, exact private-asset HTTP policy: an exact HTML/JS/CSS
// body is insufficient when CSP, CORS, caching or framing headers regress.
// Do not import the server's live header object here: the smoke must detect
// a server-side policy change rather than automatically accepting it.
const reviewedAssetHeaders = Object.freeze({
  'cache-control': 'no-store, max-age=0',
  'pragma': 'no-cache',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
});

const routes = Object.freeze([
  Object.freeze({
    path: '/__faisca_openai_private/review',
    mime: 'text/html; charset=utf-8',
    expected: PRIVATE_REVIEW_HTML
  }),
  Object.freeze({
    path: '/__faisca_openai_private/review.js',
    mime: 'text/javascript; charset=utf-8',
    expected: PRIVATE_REVIEW_JS
  }),
  Object.freeze({
    path: '/__faisca_openai_private/review.css',
    mime: 'text/css; charset=utf-8',
    expected: PRIVATE_REVIEW_CSS
  })
]);

// An injected fetch or stream may ignore AbortSignal forever. Give staging
// smoke a wall-clock deadline even when neither fetch() nor reader.read()
// cooperates with cancellation. Never await an uncooperative cancel() either.
async function awaitSmokeOrAbort(pending, signal) {
  if (signal.aborted) throw new Error('timeout');
  let onAbort;
  const cancelled = new Promise((_, reject) => {
    onAbort = () => reject(new Error('timeout'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([pending, cancelled]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

async function limitedText(response, signal) {
  if (!response.body) throw new Error('missing body');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      if (signal.aborted) throw new Error('timeout');
      const next = await awaitSmokeOrAbort(reader.read(), signal);
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 20000) throw new Error('oversized');
      chunks.push(Buffer.from(next.value));
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } finally {
    try { void Promise.resolve(reader.cancel()).catch(() => {}); }
    catch { /* uncooperative cancel() must not hang smoke */ }
  }
}

/**
 * Read-only smoke of the actual private review UI. It only requests static
 * HTML/JS/CSS via GET over loopback. No API token, OpenAI key, POST, model
 * invocation, customer text, reverse proxy or public host is involved.
 */
export async function inspectFaiscaPrivateReviewUi({
  origin = 'http://127.0.0.1:4336', fetchImpl = globalThis.fetch,
  privateConversationEnabled = false, timeoutMs = 3000
} = {}) {
  const checks = [];
  const allowedOrigin = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/.exec(origin);
  if (!allowedOrigin || Number(allowedOrigin[1]) > 65535 ||
      typeof privateConversationEnabled !== 'boolean' ||
      typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) ||
      timeoutMs < 50 || timeoutMs > 3000) {
    return Object.freeze({
      schema: FAISCA_PRIVATE_STAGING_SMOKE_SCHEMA,
      status: 'BLOCKED_INVALID_PRIVATE_ORIGIN', requests: 0,
      checks: Object.freeze([]), publicReady: false
    });
  }
  for (const item of routes) {
    let passed = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await awaitSmokeOrAbort(fetchImpl(origin + item.path, {
        method: 'GET', signal: controller.signal, redirect: 'error', cache: 'no-store',
        credentials: 'omit', referrerPolicy: 'no-referrer'
      }), controller.signal);
      const length = response.headers.get('content-length');
      if (length && (!/^[0-9]+$/.test(length) || Number(length) > 20000)) {
        throw new Error('oversized');
      }
      if (response.status !== 200 ||
          response.headers.get('content-type') !== item.mime ||
          Object.entries(reviewedAssetHeaders).some(([name, value]) =>
            response.headers.get(name) !== value) ||
          response.headers.get('access-control-allow-origin') !== null ||
          response.headers.get('access-control-allow-credentials') !== null ||
          response.headers.get('set-cookie') !== null) {
        throw new Error('unreviewed headers');
      }
      const body = await limitedText(response, controller.signal);
      // An unreviewed/stale HTML/JS/CSS asset can retain all old marker words.
      // Require an exact content match with the audited local page modules.
      // This still does not prove VPS provenance, SHA approval or public safety.
      passed = body === (privateConversationEnabled &&
        item.path === '/__faisca_openai_private/review'
        ? PRIVATE_REVIEW_CONVERSATION_HTML : item.expected);
    } catch { passed = false; }
    finally { clearTimeout(timeout); controller.abort(); }
    checks.push(Object.freeze({ path: item.path, passed }));
    // No need to perform additional probes after a failure.
    if (!passed) break;
  }
  return Object.freeze({
    schema: FAISCA_PRIVATE_STAGING_SMOKE_SCHEMA,
    status: checks.length === routes.length && checks.every(x => x.passed)
      ? 'PRIVATE_UI_READONLY_VERIFIED' : 'BLOCKED_PRIVATE_UI_NOT_VERIFIED',
    requests: checks.length,
    checks: Object.freeze(checks),
    publicReady: false,
    modelInvocations: 0
  });
}

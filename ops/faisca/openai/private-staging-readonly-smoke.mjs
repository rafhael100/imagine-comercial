import {
  PRIVATE_REVIEW_HTML, PRIVATE_REVIEW_JS, PRIVATE_REVIEW_CSS
} from './private-review-page.mjs';

export const FAISCA_PRIVATE_STAGING_SMOKE_SCHEMA = 'faisca.private-staging-readonly-smoke.v1';
const routes = Object.freeze([
  Object.freeze({
    path: '/__faisca_openai_private/review',
    mime: /^text\/html(?:;|$)/i,
    expected: PRIVATE_REVIEW_HTML
  }),
  Object.freeze({
    path: '/__faisca_openai_private/review.js',
    mime: /^text\/javascript(?:;|$)/i,
    expected: PRIVATE_REVIEW_JS
  }),
  Object.freeze({
    path: '/__faisca_openai_private/review.css',
    mime: /^text\/css(?:;|$)/i,
    expected: PRIVATE_REVIEW_CSS
  })
]);

async function limitedText(response, signal) {
  if (!response.body) throw new Error('missing body');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      if (signal.aborted) throw new Error('timeout');
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 20000) throw new Error('oversized');
      chunks.push(Buffer.from(next.value));
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } finally {
    try { await reader.cancel(); } catch { /* aborted read */ }
  }
}

/**
 * Read-only smoke of the actual private review UI. It only requests static
 * HTML/JS/CSS via GET over loopback. No API token, OpenAI key, POST, model
 * invocation, customer text, reverse proxy or public host is involved.
 */
export async function inspectFaiscaPrivateReviewUi({
  origin = 'http://127.0.0.1:4336', fetchImpl = globalThis.fetch
} = {}) {
  const checks = [];
  const allowedOrigin = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/.exec(origin);
  if (!allowedOrigin || Number(allowedOrigin[1]) > 65535 ||
      typeof fetchImpl !== 'function') {
    return Object.freeze({
      schema: FAISCA_PRIVATE_STAGING_SMOKE_SCHEMA,
      status: 'BLOCKED_INVALID_PRIVATE_ORIGIN', requests: 0,
      checks: Object.freeze([]), publicReady: false
    });
  }
  for (const item of routes) {
    let passed = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetchImpl(origin + item.path, {
        method: 'GET', signal: controller.signal, redirect: 'error', cache: 'no-store',
        credentials: 'omit', referrerPolicy: 'no-referrer'
      });
      const length = response.headers.get('content-length');
      if (length && (!/^[0-9]+$/.test(length) || Number(length) > 20000)) {
        throw new Error('oversized');
      }
      if (response.status !== 200 ||
          !item.mime.test(response.headers.get('content-type') ?? '') ||
          !/no-store/i.test(response.headers.get('cache-control') ?? '') ||
          !/noindex/i.test(response.headers.get('x-robots-tag') ?? '') ||
          response.headers.get('access-control-allow-origin') !== null ||
          response.headers.get('set-cookie') !== null ||
          !/default-src 'none'/.test(response.headers.get('content-security-policy') ?? '')) {
        throw new Error('unreviewed headers');
      }
      const body = await limitedText(response, controller.signal);
      // An unreviewed/stale HTML/JS/CSS asset can retain all old marker words.
      // Require an exact content match with the audited local page modules.
      // This still does not prove VPS provenance, SHA approval or public safety.
      passed = body === item.expected;
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

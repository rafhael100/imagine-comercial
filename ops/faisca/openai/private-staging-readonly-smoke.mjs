export const FAISCA_PRIVATE_STAGING_SMOKE_SCHEMA = 'faisca.private-staging-readonly-smoke.v1';
const routes = Object.freeze([
  Object.freeze({
    path: '/__faisca_openai_private/review',
    mime: /^text\/html(?:;|$)/i,
    required: ['Faísca', 'review-token', 'review-case']
  }),
  Object.freeze({
    path: '/__faisca_openai_private/review.js',
    mime: /^text\/javascript(?:;|$)/i,
    required: ['validCases', 'textContent', 'credentials']
  }),
  Object.freeze({
    path: '/__faisca_openai_private/review.css',
    mime: /^text\/css(?:;|$)/i,
    required: [':root', '#review-answer']
  })
]);

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
    try {
      const response = await fetchImpl(origin + item.path, {
        method: 'GET', redirect: 'error', cache: 'no-store',
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
      const body = await response.text();
      passed = Buffer.byteLength(body, 'utf8') <= 20000 &&
        item.required.every(fragment => body.includes(fragment));
    } catch { passed = false; }
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

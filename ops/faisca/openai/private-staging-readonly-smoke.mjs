import { createHash } from 'node:crypto';
import {
  PRIVATE_REVIEW_HTML, PRIVATE_REVIEW_CONVERSATION_HTML, PRIVATE_REVIEW_JS, PRIVATE_REVIEW_CSS,
  PRIVATE_REVIEW_MASCOT_PATH
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
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
});

// R147: the reviewed JS grew beyond the old 20 KB content limit as the
// independent evidence guard expanded. Keep a strict 24 KiB cap AND exact
// byte-for-byte asset matching; never disable this private read-only gate.
const MAX_PRIVATE_TEXT_ASSET_BYTES = 24 * 1024;
const approvedMascotBytes = 1887660;
const approvedMascotDigest = '1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d';
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
  }),
  Object.freeze({
    path: PRIVATE_REVIEW_MASCOT_PATH,
    mime: 'image/png',
    expectedDigest: approvedMascotDigest,
    exactBytes: approvedMascotBytes
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

async function limitedBytes(response, signal, limit) {
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
      if (bytes > limit) throw new Error('oversized');
      chunks.push(Buffer.from(next.value));
    }
    return Buffer.concat(chunks);
  } finally {
    try { void Promise.resolve(reader.cancel()).catch(() => {}); }
    catch { /* uncooperative cancel() must not hang smoke */ }
  }
}

/**
 * Read-only smoke of the actual private review UI. It only requests static
 * HTML/JS/CSS and SHA-pinned original mascot PNG via GET over loopback.
 * No API token, OpenAI key, POST, model
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
      if (item.exactBytes) {
        if (length === null || !/^[0-9]+$/.test(length) ||
            Number(length) !== item.exactBytes) throw new Error('unexpected mascot length');
      } else if (length && (!/^[0-9]+$/.test(length) || Number(length) > MAX_PRIVATE_TEXT_ASSET_BYTES)) {
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
      const bytes = await limitedBytes(response, controller.signal, item.exactBytes ?? MAX_PRIVATE_TEXT_ASSET_BYTES);
      if (item.expectedDigest) {
        // Independently pin the original human-approved PNG. Status, MIME,
        // dimensions and visible branding alone are not integrity evidence.
        passed = bytes.length === item.exactBytes &&
          createHash('sha256').update(bytes).digest('hex') === item.expectedDigest;
      } else {
        // An unreviewed/stale HTML/JS/CSS asset can retain old marker words.
        // R296: TextDecoder strips an initial UTF-8 BOM by default. Compare
        // the actual bytes instead, so a byte-altered asset cannot pass.
        const expected = privateConversationEnabled &&
          item.path === '/__faisca_openai_private/review'
          ? PRIVATE_REVIEW_CONVERSATION_HTML : item.expected;
        passed = bytes.equals(Buffer.from(expected, 'utf8'));
      }
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

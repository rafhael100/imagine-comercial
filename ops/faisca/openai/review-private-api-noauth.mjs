/**
 * R258: independent no-credential negative HTTP gate for the separate R95
 * private OpenAI API listener (127.0.0.1:4336). It NEVER sends POST,
 * Authorization, cookies, a prompt, or an OpenAI request. Unlike the R257
 * static Nginx review on 4337, this checks the private API's route boundary.
 */
import { request } from 'node:http';

const HOLD = 'R258: private API anonymous route boundary unverified (HOLD)';
const fail = () => { throw Error(HOLD); };
const MAX_HEADERS = 8192;
const MAX_BODY = 256;
const DEADLINE_MS = 2500;
const EXPECTED_BODY = '{"status":"not_found"}\n';
const CASES = Object.freeze([
  Object.freeze({ method: 'GET', path: '/__faisca_openai_private/respond' }),
  Object.freeze({ method: 'OPTIONS', path: '/__faisca_openai_private/respond' }),
  Object.freeze({ method: 'GET', path: '/__faisca_openai_private/converse' }),
  Object.freeze({ method: 'OPTIONS', path: '/__faisca_openai_private/converse' })
]);
const REQUIRED = Object.freeze({
  'cache-control': 'no-store, max-age=0',
  pragma: 'no-cache',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'content-type': 'application/json; charset=utf-8'
});
const FORBIDDEN = new Set([
  'set-cookie', 'set-cookie2', 'location', 'link', 'refresh', 'alt-svc',
  'report-to', 'reporting-endpoints', 'nel',
  'content-security-policy-report-only', 'content-location',
  'content-disposition', 'content-encoding', 'trailer', 'clear-site-data',
  'www-authenticate'
]);
function verifyResponseHeaders(response) {
  if (response.statusCode !== 404 || !Array.isArray(response.rawHeaders) ||
      response.rawHeaders.length % 2 !== 0) fail();
  const entries = new Map();
  for (let i = 0; i < response.rawHeaders.length; i += 2) {
    const name = response.rawHeaders[i], value = response.rawHeaders[i + 1];
    if (typeof name !== 'string' || typeof value !== 'string') fail();
    const lower = name.toLowerCase();
    if (entries.has(lower) || FORBIDDEN.has(lower) ||
        lower.startsWith('access-control-')) fail();
    entries.set(lower, value);
  }
  for (const [key, value] of Object.entries(REQUIRED)) {
    if (entries.get(key) !== value) fail();
  }
  if (entries.has('content-length') &&
      (!/^[0-9]+$/.test(entries.get('content-length')) ||
       Number(entries.get('content-length')) !== Buffer.byteLength(EXPECTED_BODY))) fail();
  if (entries.has('transfer-encoding') &&
      entries.get('transfer-encoding').toLowerCase() !== 'chunked') fail();
  // No ambiguity in response framing; Node's local private server may use
  // either an explicit Content-Length or chunked transfer, never both.
  if (entries.has('content-length') && entries.has('transfer-encoding')) fail();
}

function probe(port, check) {
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: '127.0.0.1',
      port, method: check.method, path: check.path,
      agent: false, maxHeaderSize: MAX_HEADERS,
      signal: AbortSignal.timeout(DEADLINE_MS),
      headers: {
        origin: 'https://synthetic-preflight.invalid',
        ...(check.method === 'OPTIONS' ? {
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization,content-type'
        } : {}),
        connection: 'close'
      }
    }, res => {
      try { verifyResponseHeaders(res); }
      catch { res.destroy(); reject(Error(HOLD)); return; }
      const chunks = [];
      let bytes = 0;
      res.on('data', chunk => {
        bytes += chunk.byteLength;
        if (bytes > MAX_BODY) {
          res.destroy(); reject(Error(HOLD)); return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        try {
          const body = new TextDecoder('utf-8', { fatal: true })
            .decode(Buffer.concat(chunks));
          if (body !== EXPECTED_BODY) fail();
          resolve(true);
        } catch { reject(Error(HOLD)); }
      });
      res.on('error', () => reject(Error(HOLD)));
    });
    req.setTimeout(DEADLINE_MS, () => req.destroy(Error(HOLD)));
    req.on('error', () => reject(Error(HOLD)));
    req.end();
  });
}

/** No operator-supplied URL/route/method or authentication of any kind. */
export async function reviewFaiscaPrivateApiAnonymousBoundary({ port = 4336 } = {}) {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) fail();
  try {
    for (const check of CASES) await probe(port, check);
  } catch { fail(); }
  return Object.freeze({
    schema: 'faisca.private-api-anonymous-boundary.v1',
    status: 'PRIVATE_API_GET_OPTIONS_NOT_FOUND_REVIEW_ONLY',
    negativeRouteChecks: CASES.length,
    noPostRequestsSent: true,
    noCredentialsSent: true,
    noOperatorTextSent: true,
    observedOnLoopbackOnly: true,
    authenticatedConversationVerified: false,
    runtimeProcessIndependentlyVerified: false,
    providerSpendReconciled: false,
    publicReady: false,
    deploymentAuthorized: false,
    deploymentPerformed: false,
    publicFaiscaEnabled: false
  });
}

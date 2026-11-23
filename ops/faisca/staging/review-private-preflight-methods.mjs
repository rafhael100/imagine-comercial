/**
 * R256: no-credential CORS preflight verification on the private Nginx
 * review surface. This is an additive OPTIONS check, not an authenticated
 * browser test and not evidence of deployment/production readiness.
 */
import { request } from 'node:http';
import { hasPrivateIdentifierRisk } from '../openai/private-identifier-risk.mjs';

const HOLD = 'R256: private OPTIONS boundary unverified (HOLD)';
const fail = () => { throw Error(HOLD); };
const DEADLINE_MS = 2500;
const MAX_HEADER_BYTES = 8192;
const MAX_BODY_BYTES = 2048;
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors ";
const CASES = Object.freeze([
  Object.freeze({ path: '/', frame: false }),
  Object.freeze({ path: '/__faisca_preview/journey/', frame: true }),
  Object.freeze({ path: '/__faisca_preview/support/index.html', frame: false }),
  Object.freeze({ path: '/__faisca_preview/quote-bridge.js?synthetic=1', frame: false })
]);
const FORBIDDEN = new Set([
  'location', 'set-cookie', 'set-cookie2', 'link', 'refresh',
  'alt-svc', 'report-to', 'reporting-endpoints', 'nel',
  'content-security-policy-report-only', 'content-encoding',
  'content-location', 'content-disposition', 'trailer'
]);
function headerFields(response) {
  const raw = response.rawHeaders;
  if (!Array.isArray(raw) || raw.length % 2 !== 0) fail();
  const map = new Map();
  for (let i = 0; i < raw.length; i += 2) {
    const name = raw[i], value = raw[i + 1];
    if (typeof name !== 'string' || typeof value !== 'string') fail();
    const lower = name.toLowerCase();
    if (FORBIDDEN.has(lower) || lower.startsWith('access-control-')) fail();
    if (map.has(lower)) {
      // Reject ambiguous duplicate headers, even if values happen to match.
      fail();
    }
    map.set(lower, value);
  }
  return map;
}
function verifyHeaders(response, check) {
  if (response.statusCode !== 401 && response.statusCode !== 403) fail();
  const h = headerFields(response);
  const exact = (name, value) => { if (h.get(name) !== value) fail(); };
  exact('cache-control', 'private, no-store, max-age=0');
  exact('x-robots-tag', 'noindex, nofollow, noarchive');
  exact('x-content-type-options', 'nosniff');
  exact('referrer-policy', 'no-referrer');
  exact('x-frame-options', check.frame ? 'SAMEORIGIN' : 'DENY');
  exact('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  exact('content-security-policy', CSP + (check.frame ? "'self'" : "'none'"));
  if (response.statusCode === 401)
    exact('www-authenticate', 'Basic realm="Imagine Faísca private review"');
  if (h.has('server') && h.get('server') !== 'nginx') fail();
  if (h.has('content-type') &&
      !/^text\/(?:html|plain)(?:;\s*charset=utf-8)?$/i.test(h.get('content-type'))) fail();
  if (h.has('content-length') &&
      (!/^[0-9]+$/.test(h.get('content-length')) ||
      Number(h.get('content-length')) > MAX_BODY_BYTES)) fail();
}
function verifyBody(chunks) {
  let body;
  try {
    body = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } catch { fail(); }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body) ||
      /<\s*\/?\s*(?:script|form|input|iframe|object|embed|video|audio|img|link|style|svg|meta)\b/i.test(body) ||
      hasPrivateIdentifierRisk(body.replace(/[\r\n\t]/g, ' '))) fail();
}
async function probe(port, check) {
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: '127.0.0.1', port,
      method: 'OPTIONS', path: check.path, agent: false,
      headers: {
        origin: 'https://synthetic-preflight.invalid',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
        connection: 'close'
      },
      signal: AbortSignal.timeout(DEADLINE_MS),
      maxHeaderSize: MAX_HEADER_BYTES
    }, res => {
      try { verifyHeaders(res, check); }
      catch { res.destroy(); reject(Error(HOLD)); return; }
      let size = 0;
      const chunks = [];
      res.on('data', chunk => {
        size += chunk.byteLength;
        if (size > MAX_BODY_BYTES) {
          res.destroy(); reject(Error(HOLD)); return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        try { verifyBody(chunks); resolve(true); }
        catch { reject(Error(HOLD)); }
      });
      res.on('error', () => reject(Error(HOLD)));
    });
    req.setTimeout(DEADLINE_MS, () => req.destroy(Error(HOLD)));
    req.on('error', () => reject(Error(HOLD)));
    req.end();
  });
}
/** Only fixed OPTIONS paths and localhost; no cookie/token, POST or redirect. */
export async function reviewFaiscaPrivateNoAuthPreflight({ port = 4337 } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail();
  try {
    for (const check of CASES) await probe(port, check);
  } catch { fail(); }
  return Object.freeze({
    schema: 'faisca.private-staging-noauth-cors-preflight.v1',
    status: 'LOCAL_NOAUTH_CORS_PREFLIGHT_DENIED_REVIEW_ONLY',
    blockedPreflightCount: CASES.length,
    noCredentialsSent: true,
    corsPermissionGranted: false,
    observedOnLoopbackOnly: true,
    authenticatedConversationVerified: false,
    dockerProcessOwnershipVerified: false,
    providerSpendReconciled: false,
    publicReady: false,
    deploymentAuthorized: false,
    deploymentPerformed: false,
    publicFaiscaEnabled: false
  });
}

/**
 * R240: NO-CREDENTIAL read-only HTTP probe for the private static review.
 * Network target is always 127.0.0.1, never a hostname or remote address.
 * Tests use an ephemeral synthetic loopback server, NOT the operational VPS.
 */
import { request } from 'node:http';
import { hasPrivateIdentifierRisk } from '../openai/private-identifier-risk.mjs';

const HOLD = 'R240: private Faísca loopback HTTP boundary unverified (HOLD)';
// R241: an idle socket timeout alone cannot stop a peer that drips bytes forever.
// This is an absolute request lifetime; neither an operator nor a fixture can raise it.
const ABSOLUTE_REQUEST_DEADLINE_MS = 2500;
const MAX_RESPONSE_HEADER_BYTES = 8192;
// An authenticated site must never leak its content through a 401 error page.
const MAX_UNAUTH_BODY_BYTES = 2048;
const fail = () => { throw Error(HOLD); };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors ";
const CASES = Object.freeze([
  Object.freeze({method:'GET',path:'/',frame:false}),
  Object.freeze({method:'GET',path:'/__faisca_preview/journey/',frame:true}),
  Object.freeze({method:'GET',path:'/__faisca_preview/support/',frame:true}),
  Object.freeze({method:'GET',path:'/__faisca_preview/quote-bridge.js',frame:false}),
  Object.freeze({method:'HEAD',path:'/__faisca_preview/journey/',frame:true})
]);
// R250: request-URI variants use the default DENY frame policy in the
// reviewed Nginx config. An alias may never bypass Basic auth or silently
// inherit SAMEORIGIN. These are fixed synthetic paths, never operator inputs.
const ALIAS_CASES = Object.freeze([
  Object.freeze({method:'GET',path:'/index.html',frame:false}),
  Object.freeze({method:'GET',path:'/__faisca_preview/journey/index.html',frame:false}),
  Object.freeze({method:'GET',path:'/__faisca_preview/support/index.html',frame:false}),
  Object.freeze({method:'GET',path:'/__faisca_preview/quote-bridge.js?synthetic=1',frame:false}),
  Object.freeze({method:'GET',path:'/__faisca_preview/journey/?synthetic=1',frame:false}),
  Object.freeze({method:'HEAD',path:'/__faisca_preview/support/index.html',frame:false})
]);
function exactHeader(response, name, value) {
  const raw = response.rawHeaders;
  if (!Array.isArray(raw) || raw.length % 2 !== 0) fail();
  let count=0;
  for (let i=0;i<raw.length;i+=2) {
    if (typeof raw[i] !== 'string' || typeof raw[i+1] !== 'string') fail();
    if (raw[i].toLowerCase() === name) {
      count++;
      if (raw[i+1] !== value) fail();
    }
  }
  if (count !== 1) fail();
}
function absentHeader(response, name) {
  if (!Array.isArray(response.rawHeaders)) fail();
  if (response.rawHeaders.some((part,i) => i%2===0 &&
    typeof part==='string' && part.toLowerCase() === name)) fail();
}
// R243: a correct 401 alone is insufficient if its response headers can
// trigger a browser preload, redirect, network report, or cross-origin policy.
// Audit raw header fields (not Node's normalized map) to reject duplicates.
const ACTIVE_UNAUTH_HEADERS = Object.freeze(new Set([
  'link', 'refresh', 'alt-svc', 'report-to', 'reporting-endpoints', 'nel',
  'content-security-policy-report-only', 'set-cookie2', 'clear-site-data',
  'content-location', 'content-disposition', 'content-encoding', 'trailer'
]));
function rejectActiveUnauthHeaders(response) {
  const raw = response.rawHeaders;
  if (!Array.isArray(raw) || raw.length % 2 !== 0) fail();
  let serverCount = 0;
  for (let i = 0; i < raw.length; i += 2) {
    const name = raw[i], value = raw[i + 1];
    if (typeof name !== 'string' || typeof value !== 'string') fail();
    const lower = name.toLowerCase();
    if (ACTIVE_UNAUTH_HEADERS.has(lower) || lower.startsWith('access-control-')) fail();
    if (lower === 'server') {
      serverCount++;
      if (value !== 'nginx') fail();
    }
  }
  if (serverCount > 1) fail();
}
function reviewResponse(response, check) {
  if (response.statusCode !== 401) fail();
  exactHeader(response,'www-authenticate','Basic realm="Imagine Faísca private review"');
  exactHeader(response,'cache-control','private, no-store, max-age=0');
  exactHeader(response,'x-robots-tag','noindex, nofollow, noarchive');
  exactHeader(response,'x-content-type-options','nosniff');
  exactHeader(response,'referrer-policy','no-referrer');
  exactHeader(response,'permissions-policy','camera=(), microphone=(), geolocation=()');
  exactHeader(response,'x-frame-options',check.frame?'SAMEORIGIN':'DENY');
  exactHeader(response,'content-security-policy',
    CSP+(check.frame?"'self'":"'none'"));
  absentHeader(response,'set-cookie');
  absentHeader(response,'location');
  absentHeader(response,'access-control-allow-origin');
  rejectActiveUnauthHeaders(response);
  // Nginx's built-in 401 is text/html. Reject unexpected data-bearing
  // response types and duplicate Content-Type fields, preserving fixtures
  // with no explicit Content-Type (Node's default).
  const types = [];
  for (let i=0;i<response.rawHeaders.length;i+=2)
    if (response.rawHeaders[i].toLowerCase() === 'content-type')
      types.push(response.rawHeaders[i+1]);
  if (types.length > 1 ||
      (types.length === 1 &&
        !/^text\/(?:html|plain)(?:;\s*charset=utf-8)?$/i.test(types[0]))) fail();
}

/**
 * R249: 401 headers alone cannot prove confidentiality. The body can still
 * contain a token, an internal URL, customer data, a script or an entire page.
 * Inspect bounded bytes without ever returning/logging them. This is a
 * conservative leakage tripwire, not general-purpose DLP.
 */
function reviewUnauthBody(chunks) {
  let body;
  try { body = new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)); }
  catch { fail(); }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(body) ||
      /<\s*\/?\s*(?:script|form|input|iframe|object|embed|video|audio|img|link|style|svg|meta)\b/i.test(body) ||
      hasPrivateIdentifierRisk(body.replace(/[\r\n\t]/g,' '))) fail();
}
async function observe(port, check) {
  return new Promise((resolve,reject) => {
    const req = request({
      hostname:'127.0.0.1', port, method:check.method, path:check.path,
      headers:{accept:'text/html','connection':'close'}, agent:false,
      signal:AbortSignal.timeout(ABSOLUTE_REQUEST_DEADLINE_MS),
      maxHeaderSize:MAX_RESPONSE_HEADER_BYTES
    },res => {
      try { reviewResponse(res,check); }
      catch { res.destroy(); reject(Error(HOLD)); return; }
      let size=0;
      const chunks=[];
      res.on('data',chunk => {
        size+=chunk.byteLength;
        if(size>MAX_UNAUTH_BODY_BYTES) {
          res.destroy(); reject(Error(HOLD)); return;
        }
        chunks.push(chunk);
      });
      res.on('end',()=>{
        try { reviewUnauthBody(chunks); resolve(true); }
        catch { reject(Error(HOLD)); }
      });
      res.on('error',()=>reject(Error(HOLD)));
    });
    // Retain the idle timeout as a second defense; the abort signal is absolute.
    req.setTimeout(ABSOLUTE_REQUEST_DEADLINE_MS,()=>req.destroy(Error(HOLD)));
    req.on('error',()=>reject(Error(HOLD)));
    req.end();
  });
}

/**
 * No auth/cookie/key is ever supplied; tests cannot establish that authenticated
 * pages are correct, what Docker/VPS is running, or any public release gate.
 * port may be ephemeral only to allow a synthetic local HTTP server in CI.
 */
export async function reviewFaiscaPrivateNoAuthLoopback({port=4337}={}) {
  if(!Number.isInteger(port)||port<1||port>65535) fail();
  try {
    for(const check of CASES) await observe(port,check);
  } catch { fail(); }
  return Object.freeze({
    schema:'faisca.private-staging-noauth-loopback-http-review.v1',
    status:'LOCAL_UNAUTHENTICATED_HTTP_BOUNDARY_REVIEW_ONLY',
    observedOnLoopbackOnly:true,
    noCredentialsSent:true,
    protectedProbeCount:CASES.length,
    authenticatedExperienceVerified:false,
    operationalVpsIdentityVerified:false,
    independentExposureVerified:false,
    deploymentAuthorized:false,
    deploymentPerformed:false,
    publicFaiscaEnabled:false
  });
}

/**
 * R250: narrow, separately invocable review of index aliases and harmless
 * query variants. Never accepts URLs, credentials, paths or headers from a
 * caller. These variants must be 401/no-store/noindex and XFO DENY, unlike
 * the two canonical frame paths. Does not authenticate or change the server.
 */
export async function reviewFaiscaPrivateNoAuthAliases({port=4337}={}) {
  if(!Number.isInteger(port)||port<1||port>65535) fail();
  try {
    for(const check of ALIAS_CASES) await observe(port,check);
  } catch { fail(); }
  return Object.freeze({
    schema:'faisca.private-staging-noauth-alias-http-review.v1',
    status:'LOCAL_UNAUTHENTICATED_ALIAS_BOUNDARY_REVIEW_ONLY',
    observedOnLoopbackOnly:true,
    noCredentialsSent:true,
    protectedProbeCount:ALIAS_CASES.length,
    inspectedCanonicalAliasAndQueryVariants:true,
    authenticatedExperienceVerified:false,
    operationalVpsIdentityVerified:false,
    independentExposureVerified:false,
    deploymentAuthorized:false,
    deploymentPerformed:false,
    publicFaiscaEnabled:false
  });
}

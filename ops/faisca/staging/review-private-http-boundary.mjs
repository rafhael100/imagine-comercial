/**
 * R240: NO-CREDENTIAL read-only HTTP probe for the private static review.
 * Network target is always 127.0.0.1, never a hostname or remote address.
 * Tests use an ephemeral synthetic loopback server, NOT the operational VPS.
 */
import { request } from 'node:http';

const HOLD = 'R240: private Faísca loopback HTTP boundary unverified (HOLD)';
// R241: an idle socket timeout alone cannot stop a peer that drips bytes forever.
// This is an absolute request lifetime; neither an operator nor a fixture can raise it.
const ABSOLUTE_REQUEST_DEADLINE_MS = 2500;
const MAX_RESPONSE_HEADER_BYTES = 8192;
const fail = () => { throw Error(HOLD); };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'self'; frame-ancestors ";
const CASES = Object.freeze([
  Object.freeze({method:'GET',path:'/',frame:false}),
  Object.freeze({method:'GET',path:'/__faisca_preview/journey/',frame:true}),
  Object.freeze({method:'GET',path:'/__faisca_preview/support/',frame:true}),
  Object.freeze({method:'GET',path:'/__faisca_preview/quote-bridge.js',frame:false}),
  Object.freeze({method:'HEAD',path:'/__faisca_preview/journey/',frame:true})
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
  // A versioned Server header would violate server_tokens off in reviewed nginx.
  const server = response.headers?.server;
  if (server !== undefined && server !== 'nginx') fail();
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
      res.on('data',chunk => {
        size+=chunk.byteLength;
        if(size>8192) { res.destroy(); reject(Error(HOLD)); }
      });
      res.on('end',()=>resolve(true));
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

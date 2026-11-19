import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { FAISCA_OPENAI_TEST_CASES } from './live-lab.mjs';

const REVIEW_PATH = '/__faisca_openai_private/respond';
const MAX_BODY_BYTES = 96;
const tokenPattern = /^[a-zA-Z0-9_-]{32,128}$/;
const PORT_RANGE = Number.isSafeInteger;
const securityHeaders = Object.freeze({
  'Cache-Control': 'no-store, max-age=0',
  'Pragma': 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Content-Type': 'application/json; charset=utf-8'
});

function send(res, status, value) {
  res.writeHead(status, securityHeaders);
  res.end(JSON.stringify(value) + '\n');
}
function authorized(req, token, hostPort) {
  const supplied = req.headers.authorization;
  const expected = 'Bearer ' + token;
  if (typeof supplied !== 'string' || Buffer.byteLength(supplied) !== Buffer.byteLength(expected)) {
    return false;
  }
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  return req.socket.remoteAddress === '127.0.0.1' &&
    req.headers.host === '127.0.0.1:' + hostPort &&
    !req.headers.origin && !req.headers.cookie &&
    !req.headers['x-forwarded-for'] &&
    timingSafeEqual(a, b);
}
async function readCaseId(req) {
  if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '')) {
    return null;
  }
  const chunks = []; let bytes = 0;
  try {
    for await (const part of req) {
      bytes += part.length;
      if (bytes > MAX_BODY_BYTES) return null;
      chunks.push(part);
    }
    const body = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
      .decode(Buffer.concat(chunks));
    // This endpoint has exactly three operator-selected synthetic cases.
    // Do not use JSON.parse here: duplicate object keys silently collapse,
    // allowing ambiguous requests (including an unreviewed earlier caseId).
    // Require the complete, tiny canonical wire shape instead. Restrict
    // whitespace to JSON's four legal ASCII whitespace bytes.
    const match = /^[ \t\r\n]*\{[ \t\r\n]*"caseId"[ \t\r\n]*:[ \t\r\n]*"(compare|process|pricing)"[ \t\r\n]*\}[ \t\r\n]*$/.exec(body);
    if (!match || !Object.hasOwn(FAISCA_OPENAI_TEST_CASES, match[1])) return null;
    return match[1];
  } catch { return null; }
}

/**
 * Loopback-only, operator-authenticated HTTP review of actual OpenAI replies.
 * No public hosting, no CORS, no cookies, no visitor text, no access to CRM or
 * Portal, and a single existing budget-gated live lab per server process.
 */
export async function startFaiscaOpenAIPrivateReview({ lab, reviewToken, port = 0 } = {}) {
  if (!lab || typeof lab.answer !== 'function' || typeof lab.inspect !== 'function' ||
      typeof reviewToken !== 'string' || !tokenPattern.test(reviewToken) ||
      !PORT_RANGE(port) || port < 0 || port > 65535 ||
      (port !== 0 && port < 1024)) {
    throw new TypeError('Private OpenAI review requires a dedicated token and safe loopback port.');
  }
  let active = true, requests = 0;
  const server = createServer(async (req, res) => {
    if (!active || req.method !== 'POST' || req.url !== REVIEW_PATH) {
      send(res, 404, { status: 'not_found' }); return;
    }
    if (!authorized(req, reviewToken, server.address().port)) {
      send(res, 403, { status: 'forbidden' }); return;
    }
    const caseId = await readCaseId(req);
    if (!caseId) { send(res, 400, { status: 'invalid_request' }); return; }
    requests++;
    try {
      const response = await lab.answer(caseId);
      send(res, 200, {
        schema: 'faisca.openai-private-review-response.v1',
        status: response.status,
        syntheticCaseId: caseId,
        answer: response.text,
        sources: response.sourceIds ?? [],
        models: response.modelIds ?? [],
        requiresEditorialReview: true,
        publicReady: false, operationalEffects: false
      });
    } catch {
      send(res, 503, {
        status: 'unavailable',
        message: 'The private AI review could not confirm a safe response.'
      });
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const address = 'http://127.0.0.1:' + server.address().port;
  return Object.freeze({
    address,
    path: REVIEW_PATH,
    inspect: () => Object.freeze({
      active, requests, bindAddress: '127.0.0.1',
      publicReady: false, operationalEffects: false,
      liveBudget: lab.inspect()
    }),
    async close() {
      if (!active) return;
      active = false;
      await new Promise(resolve => server.close(resolve));
    }
  });
}

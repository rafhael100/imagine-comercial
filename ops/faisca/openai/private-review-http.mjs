import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { FAISCA_OPENAI_MODELS, FAISCA_OPENAI_TEST_CASES } from './live-lab.mjs';

const REVIEW_PATH = '/__faisca_openai_private/respond';
const MAX_BODY_BYTES = 96;
const READ_BODY_DEADLINE = Symbol('private-review-body-deadline');
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

// A second, independent output boundary: an injected/misconfigured provider
// must not make the private HTTP endpoint serialize arbitrary data or accessors.
// This is an envelope check, NOT semantic verification of generated prose.
const reviewIdPattern = /^[a-z0-9][a-z0-9._:/@-]{0,127}$/i;
const approvedModels = new Set(Object.values(FAISCA_OPENAI_MODELS));
function safeReviewList(value, allowed = null) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > 12) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== value.length + 1) return null;
  const items = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = descriptors[index];
    if (!descriptor || !Object.hasOwn(descriptor, 'value') ||
        typeof descriptor.value !== 'string' ||
        !reviewIdPattern.test(descriptor.value) ||
        (allowed && !allowed.has(descriptor.value))) return null;
    items.push(descriptor.value);
  }
  return items;
}
function safeReviewOutput(response) {
  try {
    if (!response || typeof response !== 'object' || Array.isArray(response) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(response))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(response);
    const get = key => {
      const prop = descriptors[key];
      return prop && Object.hasOwn(prop, 'value') ? prop.value : undefined;
    };
    const status = get('status'), answer = get('text');
    if (!['draft_answer', 'unsupported'].includes(status) ||
        typeof answer !== 'string' || answer.length < 20 || answer.length > 900 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/u.test(answer) ||
        get('publicReady') === true || get('operationalEffects') === true) return null;
    const sources = safeReviewList(get('sourceIds') ?? []);
    const models = safeReviewList(get('modelIds') ?? [], approvedModels);
    if (!sources || !models || (status === 'draft_answer' && sources.length === 0)) return null;
    return Object.freeze({ status, answer, sources, models });
  } catch { return null; }
}

// A Content-Length cap does not prevent a client from sending only some bytes
// and holding a socket open. Enforce a wall-clock deadline on the body read.
async function readCaseIdBeforeDeadline(req, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      readCaseId(req),
      new Promise(resolve => { timer = setTimeout(() => resolve(READ_BODY_DEADLINE), timeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
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
  // The private operator client sends a finite, one-shot Content-Length.
  // Reject transfer-encoding, compressed or ambiguous framing up front;
  // a streamed or oversized body must never reach the paid provider.
  const contentLength = req.headers['content-length'];
  if (req.headers['transfer-encoding'] || req.headers['content-encoding'] ||
      req.headers.trailer || req.headers.expect ||
      typeof contentLength !== 'string' ||
      !/^[1-9][0-9]{0,2}$/.test(contentLength) ||
      Number(contentLength) > MAX_BODY_BYTES) return null;
  const chunks = []; let bytes = 0;
  try {
    for await (const part of req) {
      bytes += part.length;
      if (bytes > MAX_BODY_BYTES) return null;
      chunks.push(part);
    }
    if (bytes !== Number(contentLength)) return null;
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
export async function startFaiscaOpenAIPrivateReview({ lab, reviewToken, port = 0, bodyTimeoutMs = 3000 } = {}) {
  if (!lab || typeof lab.answer !== 'function' || typeof lab.inspect !== 'function' ||
      typeof reviewToken !== 'string' || !tokenPattern.test(reviewToken) ||
      !PORT_RANGE(port) || port < 0 || port > 65535 ||
      (port !== 0 && port < 1024) ||
      !Number.isInteger(bodyTimeoutMs) || bodyTimeoutMs < 50 || bodyTimeoutMs > 30000) {
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
    const caseId = await readCaseIdBeforeDeadline(req, bodyTimeoutMs);
    if (caseId === READ_BODY_DEADLINE) {
      // The request may still be waiting for bytes. Respond without touching
      // the provider; tear down the stalled connection after writing 408.
      const socket = req.socket;
      res.shouldKeepAlive = false;
      res.once('finish', () => socket.destroy());
      res.writeHead(408, { ...securityHeaders, Connection: 'close' });
      res.end(JSON.stringify({ status: 'request_timeout' }) + '\\n');
      return;
    }
    if (!caseId) { send(res, 400, { status: 'invalid_request' }); return; }
    requests++;
    try {
      const outcome = safeReviewOutput(await lab.answer(caseId));
      if (!outcome) throw new Error('Invalid private review output.');
      send(res, 200, {
        schema: 'faisca.openai-private-review-response.v1',
        status: outcome.status,
        syntheticCaseId: caseId,
        answer: outcome.answer,
        sources: outcome.sources,
        models: outcome.models,
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

import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { FAISCA_OPENAI_MODELS, FAISCA_OPENAI_TEST_CASES } from './live-lab.mjs';
import { getGroundingSources } from '../grounding/catalog.mjs';
import {
  PRIVATE_REVIEW_PAGE_PATH, PRIVATE_REVIEW_SCRIPT_PATH, PRIVATE_REVIEW_STYLE_PATH,
  PRIVATE_REVIEW_HTML, PRIVATE_REVIEW_CONVERSATION_HTML, PRIVATE_REVIEW_JS, PRIVATE_REVIEW_CSS
} from './private-review-page.mjs';

const REVIEW_PATH = '/__faisca_openai_private/respond';
const CONVERSATION_PATH = '/__faisca_openai_private/converse';
const MAX_CASE_BODY_BYTES = 96;
const MAX_CONVERSATION_BODY_BYTES = 1500;
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

// Browser review only: static content and script, never secret credentials or
// an executable action. Both the UI and the API remain bound to loopback.
const privateAssets = Object.freeze({
  [PRIVATE_REVIEW_PAGE_PATH]: Object.freeze({ body: PRIVATE_REVIEW_HTML, type: 'text/html; charset=utf-8' }),
  [PRIVATE_REVIEW_SCRIPT_PATH]: Object.freeze({ body: PRIVATE_REVIEW_JS, type: 'text/javascript; charset=utf-8' }),
  [PRIVATE_REVIEW_STYLE_PATH]: Object.freeze({ body: PRIVATE_REVIEW_CSS, type: 'text/css; charset=utf-8' })
});
const privateBrowserHeaders = Object.freeze({
  ...securityHeaders,
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'X-Frame-Options': 'DENY'
});
function privateBrowserAllowed(req, port) {
  return req.socket.remoteAddress === '127.0.0.1' &&
    req.headers.host === '127.0.0.1:' + port &&
    (!req.headers.origin || req.headers.origin === 'http://127.0.0.1:' + port) &&
    !req.headers.cookie && !req.headers['x-forwarded-for'];
}

function send(res, status, value) {
  res.writeHead(status, securityHeaders);
  res.end(JSON.stringify(value) + '\n');
}

// A second, independent output boundary: an injected/misconfigured provider
// must not make the private HTTP endpoint serialize arbitrary data or accessors.
// This is an envelope check, NOT semantic verification of generated prose.
const reviewIdPattern = /^[a-z0-9][a-z0-9._:/@-]{0,127}$/i;
const approvedModels = new Set(Object.values(FAISCA_OPENAI_MODELS));
// R85: editorial citations must be exact IDs from the pinned R06 catalog,
// not arbitrary strings that merely resemble a reviewed source.
const approvedEditorialSourceIds = new Set(getGroundingSources().map(source => source.id));
// This is a narrow, independently enforced rejection list for obvious
// invented contact/payment/operation claims. Editorial/semantic grounding
// still requires human review and cannot be certified by a regex.
const forbiddenReviewClaims =
  /https?:\/\/|\bwww\.|@[a-z0-9.-]+\.[a-z]{2,}|R\$\s*\d|\b(?:pedido|pagamento|ticket|cobrança|contrato|lead)\s+(?:foi\s+)?(?:criado|realizado|aprovado|confirmado|assinado|enviado)\b/i;
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
function safeReviewOutput(response, conversation) {
  try {
    if (!response || typeof response !== 'object' || Array.isArray(response) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(response))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(response);
    const get = key => {
      const prop = descriptors[key];
      return prop && Object.hasOwn(prop, 'value') ? prop.value : undefined;
    };
    const status = get('status'), answer = get('text');
    const accepted = conversation
      ? ['general_answer', 'editorial_answer', 'needs_confirmation']
      : ['draft_answer', 'unsupported'];
    if (!accepted.includes(status) ||
        typeof answer !== 'string' || answer.length < 20 || answer.length > 900 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/u.test(answer) ||
        forbiddenReviewClaims.test(answer) ||
        get('publicReady') === true || get('operationalEffects') === true) return null;
    const sources = safeReviewList(get('sourceIds') ?? [], approvedEditorialSourceIds);
    const models = safeReviewList(get('modelIds') ?? [], approvedModels);
    if (!sources || !models || sources.length !== new Set(sources).size) return null;
    if ((status === 'draft_answer' || status === 'general_answer') &&
        (models.length !== 2 ||
          models[0] !== FAISCA_OPENAI_MODELS.classification ||
          models[1] !== FAISCA_OPENAI_MODELS.answer)) return null;
    if ((status === 'draft_answer' || status === 'editorial_answer') && !sources.length) return null;
    if (conversation && ((status !== 'editorial_answer' && sources.length) ||
        (status !== 'general_answer' && models.length))) return null;
    return Object.freeze({ status, answer, sources, models });
  } catch { return null; }
}

// A Content-Length cap does not prevent a client from sending only some bytes
// and holding a socket open. Enforce a wall-clock deadline on the body read.
async function readRequestBeforeDeadline(req, timeoutMs, conversation) {
  let timer;
  try {
    return await Promise.race([
      readRequest(req, conversation),
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
    (!req.headers.origin || req.headers.origin === 'http://127.0.0.1:' + hostPort) &&
    !req.headers.cookie &&
    !req.headers['x-forwarded-for'] &&
    timingSafeEqual(a, b);
}
async function readRequest(req, conversation) {
  const maxBytes = conversation ? MAX_CONVERSATION_BODY_BYTES : MAX_CASE_BODY_BYTES;
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
      !/^[1-9][0-9]{0,3}$/.test(contentLength) ||
      Number(contentLength) > maxBytes) return null;
  const chunks = []; let bytes = 0;
  try {
    for await (const part of req) {
      bytes += part.length;
      if (bytes > maxBytes) return null;
      chunks.push(part);
    }
    if (bytes !== Number(contentLength)) return null;
    const body = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
      .decode(Buffer.concat(chunks));
    if (conversation) {
      // The two-element tuple cannot hide duplicate JSON object keys.
      const value = JSON.parse(body);
      if (!Array.isArray(value) || value.length !== 2 || value[0] !== true ||
          typeof value[1] !== 'string') return null;
      return { scope: 'local_operator_lab', attestedSynthetic: true, question: value[1] };
    }
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
 * No public hosting, no CORS, no cookies, no access to CRM or
 * Portal, and a single existing budget-gated live lab per server process.
 */
export async function startFaiscaOpenAIPrivateReview({
  lab, reviewToken, port = 0, bodyTimeoutMs = 3000, enablePrivateConversation = false
} = {}) {
  if (!lab || typeof lab.answer !== 'function' || typeof lab.inspect !== 'function' ||
      typeof reviewToken !== 'string' || !tokenPattern.test(reviewToken) ||
      typeof enablePrivateConversation !== 'boolean' ||
      (enablePrivateConversation && typeof lab.answerPrivateConversation !== 'function') ||
      !PORT_RANGE(port) || port < 0 || port > 65535 ||
      (port !== 0 && port < 1024) ||
      !Number.isInteger(bodyTimeoutMs) || bodyTimeoutMs < 50 || bodyTimeoutMs > 30000) {
    throw new TypeError('Private OpenAI review requires a dedicated token and safe loopback port.');
  }
  let active = true, requests = 0, inFlight = false;
  const server = createServer(async (req, res) => {
    if (active && req.method === 'GET' && Object.hasOwn(privateAssets, req.url)) {
      if (!privateBrowserAllowed(req, server.address().port)) {
        send(res, 403, { status: 'forbidden' }); return;
      }
      const asset = privateAssets[req.url];
      res.writeHead(200, { ...privateBrowserHeaders, 'Content-Type': asset.type });
      res.end(enablePrivateConversation && req.url === PRIVATE_REVIEW_PAGE_PATH
        ? PRIVATE_REVIEW_CONVERSATION_HTML
        : asset.body);
      return;
    }
    const conversation = enablePrivateConversation && req.url === CONVERSATION_PATH;
    if (!active || req.method !== 'POST' || (!conversation && req.url !== REVIEW_PATH)) {
      send(res, 404, { status: 'not_found' }); return;
    }
    if (!authorized(req, reviewToken, server.address().port)) {
      send(res, 403, { status: 'forbidden' }); return;
    }
    const input = await readRequestBeforeDeadline(req, bodyTimeoutMs, conversation);
    if (input === READ_BODY_DEADLINE) {
      // The request may still be waiting for bytes. Respond without touching
      // the provider; tear down the stalled connection after writing 408.
      const socket = req.socket;
      res.shouldKeepAlive = false;
      res.once('finish', () => socket.destroy());
      const payload = JSON.stringify({ status: 'request_timeout' }) + '\n';
      res.writeHead(408, {
        ...securityHeaders, Connection: 'close',
        'Content-Length': Buffer.byteLength(payload)
      });
      res.end(payload);
      return;
    }
    if (!input) { send(res, 400, { status: 'invalid_request' }); return; }
    // The live lab implements its own busy guard, but the HTTP boundary must
    // also serialize a misconfigured/injected provider. No parallel API calls
    // or implicit retries may arise from one review server.
    if (inFlight) { send(res, 429, { status: 'busy' }); return; }
    inFlight = true;
    requests++;
    try {
      const reply = await (conversation ? lab.answerPrivateConversation(input) : lab.answer(input));
      if (conversation && reply === null) {
        send(res, 400, { status: 'invalid_question' }); return;
      }
      const outcome = safeReviewOutput(reply, conversation);
      if (!outcome) throw new Error('Invalid private review output.');
      send(res, 200, {
        schema: conversation
          ? 'faisca.openai-private-conversation-response.v1'
          : 'faisca.openai-private-review-response.v1',
        status: outcome.status,
        ...(conversation ? {} : { syntheticCaseId: input }),
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
    } finally { inFlight = false; }
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
      active, requests, inFlight, bindAddress: '127.0.0.1',
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

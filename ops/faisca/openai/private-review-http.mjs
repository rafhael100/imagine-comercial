import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { FAISCA_OPENAI_LIVE_LAB_SCHEMA, FAISCA_OPENAI_MODELS, FAISCA_OPENAI_TEST_CASES } from './live-lab.mjs';
import { getGroundedAnswer } from '../grounding/guide.mjs';
import { retrieveCandidateAnswerIds } from '../model-router/contract.mjs';
import { getGroundingSources } from '../grounding/catalog.mjs';
import { privateConversationRoute, safePrivateGeneralReply } from './private-conversation-policy.mjs';
import { readPrivateSyntheticQuestion } from './private-question-gate.mjs';
import {
  PRIVATE_REVIEW_PAGE_PATH, PRIVATE_REVIEW_SCRIPT_PATH, PRIVATE_REVIEW_STYLE_PATH,
  PRIVATE_REVIEW_HTML, PRIVATE_REVIEW_CONVERSATION_HTML, PRIVATE_REVIEW_JS, PRIVATE_REVIEW_CSS
} from './private-review-page.mjs';

const REVIEW_PATH = '/__faisca_openai_private/respond';
const CONVERSATION_PATH = '/__faisca_openai_private/converse';
const MAX_BODY_BYTES = 96;
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
function safeReviewOutput(response, caseId) {
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
        forbiddenReviewClaims.test(answer) ||
        get('publicReady') === true || get('operationalEffects') === true) return null;
    const sources = safeReviewList(get('sourceIds') ?? [], approvedEditorialSourceIds);
    const models = safeReviewList(get('modelIds') ?? [], approvedModels);
    // R83: a claimed Luna + Terra generated draft must show both model IDs,
    // exactly once and in the required classification -> answer sequence.
    // An empty/partial/duplicated provenance list is not evidence of a model reply.
    if (!sources || !models || sources.length !== new Set(sources).size ||
        (status === 'draft_answer' && (
      sources.length === 0 || models.length !== 2 ||
      models[0] !== FAISCA_OPENAI_MODELS.classification ||
      models[1] !== FAISCA_OPENAI_MODELS.answer))) return null;
    // Real R72 results include the live-lab schema and Luna-selected answerId.
    // An allowlisted source may still refer to a completely unrelated recipe:
    // bind the *ordered exact list* to the selected host-reviewed answer and
    // ensure it was a candidate for the operator's fixed synthetic question.
    // Legacy untagged provider fixtures remain possible in older HTTP tests,
    // but they are never represented as a source-recipe verified result.
    const schema = get('schema');
    const hasAnswerId = Object.hasOwn(descriptors, 'answerId');
    const realEnvelope = schema === FAISCA_OPENAI_LIVE_LAB_SCHEMA;
    if ((schema !== undefined && !realEnvelope) ||
        (hasAnswerId && !Object.hasOwn(descriptors.answerId, 'value')) ||
        (hasAnswerId && !realEnvelope)) return null;
    let sourceRecipeBound = false;
    if (realEnvelope && status === 'draft_answer') {
      const selectedId = get('answerId');
      const candidates = retrieveCandidateAnswerIds(FAISCA_OPENAI_TEST_CASES[caseId]);
      const grounded = typeof selectedId === 'string' && candidates.includes(selectedId)
        ? getGroundedAnswer(selectedId) : null;
      const expected = grounded?.sources.map(source => source.id);
      if (!expected || expected.length !== sources.length ||
          expected.some((id, index) => sources[index] !== id)) return null;
      sourceRecipeBound = true;
    }
    if (realEnvelope && status === 'unsupported' &&
        (hasAnswerId || sources.length !== 0 || models.length !== 0 ||
         get('source') !== 'host_fixed_fallback')) return null;
    return Object.freeze({ status, answer, sources, models, sourceRecipeBound });
  } catch { return null; }
}

// R95: conversation output has an independent host-side gate. Real editorial
// citations require exact text and source order from a pinned R06 recipe.
// General responses never assert Imagine prices or operational authority.
function safeConversationOutput(response, input) {
  try {
    if (!input || typeof input.question !== 'string' ||
        !response || typeof response !== 'object' || Array.isArray(response) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(response))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(response);
    const get = key => {
      const descriptor = descriptors[key];
      return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
    };
    const status = get('status'), answer = get('text');
    if (!['general_answer','editorial_answer','needs_confirmation'].includes(status) ||
        typeof answer !== 'string' || answer.length < 20 || answer.length > 900 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/u.test(answer) ||
        forbiddenReviewClaims.test(answer) ||
        get('publicReady') === true || get('operationalEffects') === true) return null;
    const sources = safeReviewList(get('sourceIds') ?? [], approvedEditorialSourceIds);
    const models = safeReviewList(get('modelIds') ?? [], approvedModels);
    if (!sources || !models || sources.length !== new Set(sources).size) return null;
    const route = privateConversationRoute(input.question);
    if (route === 'rejected') return null;
    if (status === 'general_answer') {
      if (route !== 'classify' || sources.length !== 0 || models.length !== 2 ||
          models[0] !== FAISCA_OPENAI_MODELS.classification ||
          models[1] !== FAISCA_OPENAI_MODELS.answer ||
          !safePrivateGeneralReply(answer)) return null;
      return Object.freeze({ status, answer, sources, models, sourceRecipeBound: false });
    }
    if (models.length !== 0) return null;
    if (status === 'needs_confirmation') {
      if (sources.length !== 0 ||
          answer !== 'Essa informação precisa ser confirmada com a equipe da Imagine.') return null;
      return Object.freeze({ status, answer, sources, models, sourceRecipeBound: false });
    }
    if (!['pricing','process'].includes(route)) return null;
    const approved = getGroundedAnswer(route);
    const expected = approved?.sources.map(source => source.id);
    if (!expected || approved.text !== answer || expected.length !== sources.length ||
        expected.some((id, index) => id !== sources[index])) return null;
    return Object.freeze({ status, answer, sources, models, sourceRecipeBound: true });
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
  const maxBytes = conversation ? MAX_CONVERSATION_BODY_BYTES : MAX_BODY_BYTES;
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
      // Canonical two-element tuple, not an object with duplicate keys.
      // Inputs are fictional and are rechecked by the private gate in the lab.
      const value = JSON.parse(body);
      if (!Array.isArray(value) || value.length !== 2 || value[0] !== true ||
          typeof value[1] !== 'string' || value[1].length > 240) return null;
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
 * No public hosting, no CORS, no cookies, no visitor text, no access to CRM or
 * Portal, and a single existing budget-gated live lab per server process.
 */
export async function startFaiscaOpenAIPrivateReview({
  lab, reviewToken, port = 0, bodyTimeoutMs = 3000,
  enablePrivateConversation = false
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
        ? PRIVATE_REVIEW_CONVERSATION_HTML : asset.body);
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
    // Independent HTTP preflight: an injected/misconfigured lab must never see
    // raw operator input that failed the same synthetic privacy boundary.
    // Count authorized invalid attempts as before, but never dispatch them.
    if (conversation && readPrivateSyntheticQuestion(input) === null) {
      requests++;
      send(res, 400, { status: 'invalid_question' });
      return;
    }
    // The live lab implements its own busy guard, but the HTTP boundary must
    // also serialize a misconfigured/injected provider. No parallel API calls
    // or implicit retries may arise from one review server.
    if (inFlight) { send(res, 429, { status: 'busy' }); return; }
    inFlight = true;
    requests++;
    try {
      const reply = await (conversation
        ? lab.answerPrivateConversation(input) : lab.answer(input));
      if (conversation && reply === null) {
        send(res, 400, { status: 'invalid_question' }); return;
      }
      const outcome = conversation ? safeConversationOutput(reply, input)
        : safeReviewOutput(reply, input);
      if (!outcome) throw new Error('Invalid private review output.');
      send(res, 200, {
        schema: conversation ? 'faisca.openai-private-conversation-response.v1'
          : 'faisca.openai-private-review-response.v1',
        status: outcome.status,
        ...(conversation ? {} : { syntheticCaseId: input }),
        answer: outcome.answer,
        sources: outcome.sources,
        models: outcome.models,
        sourceRecipeBound: outcome.sourceRecipeBound,
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

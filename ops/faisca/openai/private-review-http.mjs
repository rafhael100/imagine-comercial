import { createServer } from 'node:http';
import { timingSafeEqual, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { FAISCA_OPENAI_LIVE_LAB_SCHEMA, FAISCA_OPENAI_MODELS, FAISCA_OPENAI_TEST_CASES, FAISCA_OPENAI_UNSUPPORTED_FALLBACK } from './live-lab.mjs';
import { getGroundedAnswer } from '../grounding/guide.mjs';
import { retrieveCandidateAnswerIds } from '../model-router/contract.mjs';
import { getGroundingSources } from '../grounding/catalog.mjs';
import { privateConversationRoute, safePrivateGeneralReply, hasPrivateOperationalClaim, hasPrivateUnsupportedOutcomeGuarantee, PRIVATE_CONVERSATION_CONFIRMATION_TEXT } from './private-conversation-policy.mjs';
import { readPrivateSyntheticQuestion } from './private-question-gate.mjs';
import { hasPrivateIdentifierRisk } from './private-identifier-risk.mjs';
import { hasPrivateUnreviewedPriceClaim } from './private-price-claim-risk.mjs';
import { hasPrivateSyntheticInstructionOverrideRisk } from './private-synthetic-instruction-risk.mjs';
import {
  PRIVATE_REVIEW_PAGE_PATH, PRIVATE_REVIEW_SCRIPT_PATH, PRIVATE_REVIEW_STYLE_PATH, PRIVATE_REVIEW_MASCOT_PATH,
  PRIVATE_REVIEW_HTML, PRIVATE_REVIEW_CONVERSATION_HTML, PRIVATE_REVIEW_JS, PRIVATE_REVIEW_CSS
} from './private-review-page.mjs';

const REVIEW_PATH = '/__faisca_openai_private/respond';
// Independent pin from the human-approved asset manifest. This endpoint
// never serves arbitrary files, variants or user-supplied image paths.
const APPROVED_MASCOT_SHA256 = '1ede4d88a38e238523c6db7351f22654ffa40b9f8ee2260ea31b162763d8c87d';
const CONVERSATION_PATH = '/__faisca_openai_private/converse';
const MAX_BODY_BYTES = 96;
const MAX_CONVERSATION_BODY_BYTES = 1500;
const READ_BODY_DEADLINE = Symbol('private-review-body-deadline');
const PROVIDER_DEADLINE = Symbol('private-review-provider-deadline');
const REJECTED_PRIVATE_OUTPUT = Symbol('private-review-rejected-output');
const CLIENT_DISCONNECTED = Symbol('private-review-client-disconnected');
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
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'X-Frame-Options': 'DENY'
});
// Node's HTTP/1 parser retains only the first Host/Authorization header in
// req.headers, silently hiding a conflicting second header from applications.
// Reject ambiguous security inputs by inspecting the actual wire headers.
// Never accept proxy-originated requests for this loopback-only paid lab.
const singletonPrivateHeaders = new Set([
  'host', 'origin', 'authorization', 'content-type', 'content-length',
  'transfer-encoding', 'content-encoding', 'cookie', 'expect', 'trailer'
]);
function unambiguousPrivateHeaders(req) {
  if (!Array.isArray(req.rawHeaders) || req.rawHeaders.length % 2 !== 0) return false;
  const seen = new Set();
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    const name = req.rawHeaders[i].toLowerCase();
    if (name === 'forwarded' || name === 'x-real-ip' ||
        name.startsWith('x-forwarded-')) return false;
    if (singletonPrivateHeaders.has(name)) {
      if (seen.has(name)) return false;
      seen.add(name);
    }
  }
  return seen.has('host');
}

function privateBrowserAllowed(req, port) {
  return unambiguousPrivateHeaders(req) &&
    req.socket.remoteAddress === '127.0.0.1' &&
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
    // A failure-to-ground result is a host-owned fixed fallback, never
    // provider-authored text that could invent facts or imply an action.
    if (!['draft_answer', 'unsupported'].includes(status) ||
        (status === 'unsupported' && answer !== FAISCA_OPENAI_UNSUPPORTED_FALLBACK) ||
        typeof answer !== 'string' || answer.length < 20 || answer.length > 900 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/u.test(answer) ||
         // Reject default-ignorable Unicode at the authoritative HTTP egress,
         // including U+034F (combining grapheme joiner) missed by Cc/Cf checks.
         /\p{Default_Ignorable_Code_Point}/u.test(answer) ||
        forbiddenReviewClaims.test(answer.normalize('NFKC')) ||
        hasPrivateSyntheticInstructionOverrideRisk(answer) ||
        // Fixed-case replies also lack any authority to publish a site or
        // activate campaigns. R106 guarded free text; apply the same host
        // semantic tripwires to R72/R79 fixed drafts and injected adapters.
        hasPrivateOperationalClaim(answer) ||
        hasPrivateIdentifierRisk(answer) ||
        hasPrivateUnreviewedPriceClaim(answer) ||
         hasPrivateUnsupportedOutcomeGuarantee(answer) ||
        get('publicReady') === true || get('operationalEffects') === true) return null;
    const sources = safeReviewList(get('sourceIds') ?? [], approvedEditorialSourceIds);
    const models = safeReviewList(get('modelIds') ?? [], approvedModels);
    // R83: a claimed Luna + Terra generated draft must show both model IDs,
    // exactly once and in the required classification -> answer sequence.
    // An empty/partial/duplicated provenance list is not evidence of a model reply.
    // An unsupported result is an ungrounded fallback, never a place to
    // attach real editorial source IDs or Luna/Terra provenance. Apply the
    // privacy egress gate to *every* status, not only generated drafts.
    if (!sources || !models || sources.length !== new Set(sources).size ||
        (status === 'unsupported' && (sources.length !== 0 || models.length !== 0)) ||
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
         // Reject default-ignorable Unicode at the authoritative HTTP egress,
         // including U+034F (combining grapheme joiner) missed by Cc/Cf checks.
         /\p{Default_Ignorable_Code_Point}/u.test(answer) ||
        forbiddenReviewClaims.test(answer.normalize('NFKC')) ||
        hasPrivateSyntheticInstructionOverrideRisk(answer) ||
        hasPrivateUnreviewedPriceClaim(answer) ||
         hasPrivateUnsupportedOutcomeGuarantee(answer) ||
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
          answer !== PRIVATE_CONVERSATION_CONFIRMATION_TEXT) return null;
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
  return unambiguousPrivateHeaders(req) &&
    req.socket.remoteAddress === '127.0.0.1' &&
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
  providerDeadlineMs = 30000, deliveryAckDeadlineMs = 3000,
  enablePrivateConversation = false
} = {}) {
  if (!lab || typeof lab.answer !== 'function' || typeof lab.inspect !== 'function' ||
      typeof reviewToken !== 'string' || !tokenPattern.test(reviewToken) ||
      typeof enablePrivateConversation !== 'boolean' ||
      (enablePrivateConversation && typeof lab.answerPrivateConversation !== 'function') ||
      !PORT_RANGE(port) || port < 0 || port > 65535 ||
      (port !== 0 && port < 1024) ||
      !Number.isInteger(bodyTimeoutMs) || bodyTimeoutMs < 50 || bodyTimeoutMs > 30000 ||
      !Number.isInteger(providerDeadlineMs) || providerDeadlineMs < 50 || providerDeadlineMs > 30000 ||
      !Number.isInteger(deliveryAckDeadlineMs) || deliveryAckDeadlineMs < 50 ||
      deliveryAckDeadlineMs > 30000) {
    throw new TypeError('Private OpenAI review requires a dedicated token and safe loopback port.');
  }
  // R271: a future/private adapter cannot claim a durable reservation ledger
  // yet omit the final paid-dispatch check introduced by R270. Fail before
  // binding the listener rather than silently downgrading to a weak adapter.
  const initialDurabilityClaim = lab.inspect()?.localDurableReservations;
  // Do not silently treat a truthy string/number as an adapter without a
  // ledger. Missing is allowed for legacy synthetic non-durable fixtures.
  if (initialDurabilityClaim !== undefined &&
      typeof initialDurabilityClaim !== 'boolean') {
    throw new TypeError('Private review requires a boolean durable capability.');
  }
  const requiresDurableDeliveryFence = initialDurabilityClaim === true;
  if (requiresDurableDeliveryFence &&
      typeof lab.assertPrivateHttpDeliverySafe !== 'function') {
    throw new TypeError('Private durable review requires an HTTP delivery fence.');
  }
  // R273: a completed HTTP write must release a durable dispatch marker,
  // while any uncertain delivery must retain a persistent NO-START marker.
  // A future adapter that advertises a ledger but omits either hook must
  // fail before opening the private port, not silently lose the lifecycle.
  if (requiresDurableDeliveryFence &&
      (typeof lab.acknowledgeHttpDelivery !== 'function' ||
       typeof lab.markDeliveryUncertain !== 'function')) {
    throw new TypeError('Private durable review requires HTTP delivery lifecycle hooks.');
  }
  // R275: property presence is insufficient: an injected adapter could
  // replace a vetted method with another function after the listener binds.
  // Pin the original hooks so even a late replacement cannot intercept the
  // persistent NO-START signal or the post-write acknowledgement.
  const pinnedDurableHooks = Object.freeze({
    assert: lab.assertPrivateHttpDeliverySafe,
    acknowledge: lab.acknowledgeHttpDelivery,
    uncertain: lab.markDeliveryUncertain
  });
  function stableDurableHooks() {
    return !requiresDurableDeliveryFence ||
      (lab.assertPrivateHttpDeliverySafe === pinnedDurableHooks.assert &&
       lab.acknowledgeHttpDelivery === pinnedDurableHooks.acknowledge &&
       lab.markDeliveryUncertain === pinnedDurableHooks.uncertain);
  }
  // R274: inspect() is injected and can change after bind. A runtime that
  // starts as durable must not silently downgrade its claim (or vice versa)
  // while HTTP accepts a new paid turn or prepares to emit HTTP 200.
  // Inspect failures are unsafe; they never authorize provider dispatch.
  function stableDurabilityClaim() {
    try {
      return lab.inspect()?.localDurableReservations === initialDurabilityClaim;
    } catch { return false; }
  }
  const mascot = await readFile(new URL('../assets/faisca-master.png', import.meta.url));
  if (mascot.byteLength !== 1887660 ||
      createHash('sha256').update(mascot).digest('hex') !== APPROVED_MASCOT_SHA256 ||
      !mascot.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
      mascot.readUInt32BE(16) !== 1254 || mascot.readUInt32BE(20) !== 1254) {
    throw new Error('R122: the approved Faísca mascot is missing or changed.');
  }
  // Once provider completion becomes uncertain, never permit a second paid
  // dispatch from this server. The operator must close, review and restart.
  let active = true, requests = 0, inFlight = false, providerUnavailable = false;
  let deliveryFenceStarted = false;
  let deliveryFence = Promise.resolve();
  let deliveryAck = Promise.resolve();
  // An HTTP disconnect/deadline can lose a perfectly valid provider reply.
  // Persist an operator-only no-start marker before a *graceful* shutdown.
  // Failed persistence never reopens the process. Abrupt host/process death
  // before fsync still needs an independent reconciliation/lease gate.
  function latchUncertainDelivery() {
    providerUnavailable = true;
    if (deliveryFenceStarted) return;
    deliveryFenceStarted = true;
    const markUncertain = requiresDurableDeliveryFence
      ? pinnedDurableHooks.uncertain : lab.markDeliveryUncertain;
    if (typeof markUncertain === 'function') {
      deliveryFence = Promise.resolve().then(() => markUncertain.call(lab))
        .catch(() => {}); // Never expose file-system or provider details.
    }
  }
  const server = createServer(async (req, res) => {
    if (active && req.method === 'GET' && req.url === PRIVATE_REVIEW_MASCOT_PATH) {
      if (!privateBrowserAllowed(req, server.address().port)) {
        send(res, 403, { status: 'forbidden' }); return;
      }
      res.writeHead(200, { ...privateBrowserHeaders,
        'Content-Type': 'image/png', 'Content-Length': mascot.byteLength });
      res.end(mascot);
      return;
    }
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
    if (providerUnavailable) { send(res, 503, { status: 'unavailable' }); return; }
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
    // Do not start a new paid turn until the previous successful HTTP write
    // has durably released its same-host dispatch fence.
    await deliveryAck;
    if (providerUnavailable) { send(res, 503, { status: 'unavailable' }); return; }
    // Never invoke an adapter whose durable-reservation capability changed
    // after listener startup: the safety hooks were vetted for the old claim.
    if (!stableDurabilityClaim()) {
      latchUncertainDelivery();
      send(res, 503, { status: 'unavailable' }); return;
    }
    if (inFlight) { send(res, 429, { status: 'busy' }); return; }
    inFlight = true;
    requests++;
    let providerTimer, providerDispatched = false;
    // Losing the HTTP client mid-flight makes provider completion and delivery
    // uncertain. Never permit another potentially paid dispatch in that
    // process, even if the detached provider promise eventually resolves.
    // A clean response emits 'finish' before 'close' and does not trip this.
    const onPrematureResponseClose = () => {
      if (providerDispatched && !res.writableFinished) latchUncertainDelivery();
    };
    res.once('close', onPrematureResponseClose);
    try {
      // The R105 API client has its own deadline, but an injected or future
      // adapter can ignore it. Enforce a separate HTTP completion deadline.
      // Never reuse the session after the outcome is uncertain: the original
      // promise may still complete or charge later despite timing out here.
      const reply = await Promise.race([
        Promise.resolve().then(() => {
          // A closed client before dispatch must not consume any API credit.
          if (res.destroyed) throw CLIENT_DISCONNECTED;
          providerDispatched = true;
          return conversation
            ? lab.answerPrivateConversation(input, { requireHttpDeliveryAck: true })
            : lab.answer(input, { requireHttpDeliveryAck: true });
        }),
        new Promise(resolve => {
          providerTimer = setTimeout(() => resolve(PROVIDER_DEADLINE), providerDeadlineMs);
        })
      ]);
      if (reply === PROVIDER_DEADLINE) {
        latchUncertainDelivery();
        throw new Error('Uncertain private provider completion.');
      }
      if (conversation && reply === null) {
        send(res, 400, { status: 'invalid_question' }); return;
      }
      const outcome = conversation ? safeConversationOutput(reply, input)
        : safeReviewOutput(reply, input);
      if (!outcome) throw REJECTED_PRIVATE_OUTPUT;
      // A provider may mutate an injected adapter after dispatch. Its
      // durability claim must still match the capability vetted at bind.
      if (!stableDurabilityClaim()) {
        throw new Error('Private durable capability changed during dispatch.');
      }
      // Reject late replacement, not only deletion, of the vetted hooks.
      // The pinned uncertainty hook remains available to the error path.
      if (!stableDurableHooks()) {
        throw new Error('Private durable lifecycle hook identity changed.');
      }
      // R270: editorial validation can take place after the last provider
      // completion check. Revalidate the fsynced single-host NO-START marker
      // immediately before replying, but never claim an atomic socket fence.
      if (requiresDurableDeliveryFence &&
          typeof lab.assertPrivateHttpDeliverySafe !== 'function') {
        throw new Error('Private HTTP delivery fence unavailable.');
      }
      // Recheck in case a mutable injected adapter withdrew a required hook
      // after the listener was initialized. Never emit HTTP 200 in that case.
      if (requiresDurableDeliveryFence &&
          (typeof lab.acknowledgeHttpDelivery !== 'function' ||
           typeof lab.markDeliveryUncertain !== 'function')) {
        throw new Error('Private durable HTTP delivery lifecycle unavailable.');
      }
      const deliveryCheck = requiresDurableDeliveryFence
        ? pinnedDurableHooks.assert : lab.assertPrivateHttpDeliverySafe;
      if (typeof deliveryCheck === 'function') {
        // R272: the fence must positively affirm a safe, current dispatch.
        // False/undefined/null are not a success signal. A future adapter
        // silently returning a negative decision must never emit HTTP 200.
        // R315: a stuck final assertion is outside the provider race. Bound
        // it independently, like the durable ACK, so a stalled ledger cannot
        // keep the socket and in-flight admission occupied indefinitely.
        // Timeout latches NO-START; a late affirmation cannot publish a reply.
        let fenceTimer;
        try {
          const confirmed = await Promise.race([
            Promise.resolve().then(() => deliveryCheck.call(lab)),
            new Promise((_, reject) => {
              fenceTimer = setTimeout(
                () => reject(new Error('Private HTTP delivery fence deadline exceeded.')),
                deliveryAckDeadlineMs
              );
            })
          ]);
          if (confirmed !== true) {
            throw new Error('Private HTTP delivery fence did not affirm safety.');
          }
        } finally { clearTimeout(fenceTimer); }
      }
      // R276: the awaited durable fence is a scheduling boundary. Another
      // task (including an injected adapter) can replace a vetted method or
      // withdraw the durability claim while the assertion is pending. Check
      // again synchronously after its last await and before writing HTTP 200.
      // This does NOT make a cross-process marker and socket write atomic.
      if (!stableDurabilityClaim() || !stableDurableHooks()) {
        throw new Error('Private HTTP delivery safety changed during final fence.');
      }
      if (res.destroyed) {
        latchUncertainDelivery();
        return; // The browser did not receive this reply; require operator review.
      }
      // An upstream completion is not the same as a locally completed HTTP
      // response. Release the durable cross-process marker only on 'finish'.
      // Any abrupt death before this handler leaves a permanent NO-START.
      const acknowledge = requiresDurableDeliveryFence
        ? pinnedDurableHooks.acknowledge : lab.acknowledgeHttpDelivery;
      if (typeof acknowledge === 'function') {
        res.once('finish', () => {
          let ackTimer;
          deliveryAck = Promise.race([
            Promise.resolve().then(() => acknowledge.call(lab)),
            new Promise((_, reject) => {
              // R280: a broken/injected ACK may never settle. Bound the
              // waiting socket and latch NO-START, without retrying or
              // refunding an already completed provider request.
              ackTimer = setTimeout(
                () => reject(new Error('Private durable HTTP ACK deadline exceeded.')),
                deliveryAckDeadlineMs
              );
            })
          ]).then(confirmed => {
            // R278: a resolved promise is not proof that the durable
            // dispatch marker was released. Require an affirmative result.
            if (requiresDurableDeliveryFence && confirmed !== true) {
              throw new Error('Private durable HTTP acknowledgement was not affirmed.');
            }
          }).catch(() => { latchUncertainDelivery(); })
            .finally(() => clearTimeout(ackTimer));
        });
      }
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
    } catch (error) {
      // Transport/provider exceptions may have incurred a charge despite not
      // yielding a response. Lock this process until operator review. Unsafe
      // but *completed* model outputs remain 503 without opening the breaker,
      // so separate synthetic negative editorial fixtures can be evaluated.
      // In neither case do we retry or release the durable reservation.
      if (error !== REJECTED_PRIVATE_OUTPUT && error !== CLIENT_DISCONNECTED) latchUncertainDelivery();
      if (!res.destroyed) send(res, 503, {
        status: 'unavailable',
        message: 'The private AI review could not confirm a safe response.'
      });
    } finally {
      clearTimeout(providerTimer);
      if (res.destroyed && providerDispatched && !res.writableFinished) latchUncertainDelivery();
      res.off('close', onPrematureResponseClose);
      inFlight = false;
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
      active, requests, inFlight, providerUnavailable, bindAddress: '127.0.0.1',
      publicReady: false, operationalEffects: false,
      liveBudget: lab.inspect()
    }),
    async close() {
      if (!active) return;
      active = false;
      await new Promise(resolve => server.close(resolve));
      await deliveryAck;
      await deliveryFence;
    }
  });
}

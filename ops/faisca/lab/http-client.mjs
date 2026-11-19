import { createSession, respond } from '../core.mjs';
import { CONVERSATION_SCHEMA, validateConversationRequest } from '../conversation-contract.mjs';
import { HTTP_PATHS, validateHttpSession, validateHttpResult, validateHttpError, httpResultToOutcome } from '../http-contract.mjs';

const blockedIntents = new Set(['sensitive_input', 'unsupported_instruction', 'invalid_input', 'too_long', 'invalid_session']);
const notices = Object.freeze({
  closed: 'Esta conversa de laboratório foi encerrada. Reinicie a conversa para continuar.',
  busy: 'A mensagem anterior continua sem confirmação. Consulte o resultado ou reinicie a conversa.',
  unavailable: 'Não consegui iniciar a sessão de laboratório. Nenhuma mensagem foi enviada ao servidor.',
  transport_rejected: 'O servidor de laboratório recusou a mensagem. Reinicie a conversa para continuar.'
});
const id = () => globalThis.crypto.randomUUID().replaceAll('-', '');
const localOutcome = (status, text = notices[status]) => Object.freeze({ status, delivery: 'none', accepted: false,
  reason: status, mode: 'simulated_lab', operationalEffects: false,
  reply: Object.freeze({ text, state: status === 'busy' ? 'WAIT' : 'ERROR', intent: status,
    sources: Object.freeze([]), actions: Object.freeze([{ id: 'home', label: 'Ver as jornadas' }]) }) });

function checkedOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new TypeError('Loopback laboratory origin required.'); }
  if (url.origin !== value || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new TypeError('Only the same loopback laboratory origin is supported.');
  }
  return value;
}

async function readJson(response) {
  if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(response.headers.get('content-type') || '')) throw new Error('Invalid response type.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing response body.');
  let bytes = 0;
  const chunks = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16384) { await reader.cancel(); throw new Error('Response too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
}

/** Trusted host configuration only; no endpoint, provider or authority from visitor data. */
export function createHttpConversationClient({ origin = globalThis.location?.origin,
  fetchImpl = (url, options) => globalThis.fetch(url, options), timeoutMs = 2500, onState = () => {},
  prepareTurn = null, validatePreparedResult = null, createGuideSession = createSession } = {}) {
  origin = checkedOrigin(origin);
  if (typeof fetchImpl !== 'function' || typeof onState !== 'function' ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000 ||
      !((prepareTurn === null && validatePreparedResult === null) ||
        (typeof prepareTurn === 'function' && typeof validatePreparedResult === 'function')) ||
      typeof createGuideSession !== 'function') {
    throw new TypeError('Invalid laboratory HTTP client.');
  }
  let live = true, generation = 0, session = null, pending = null, blocked = false;
  let guideSession = createGuideSession();
  const controllers = new Set();
  const current = entry => live && entry.generation === generation && pending === entry;
  const emit = (status, text = '', canReconcile = false) => {
    try { onState(Object.freeze({ status, text, canReconcile })); } catch { /* The host cannot affect transport state. */ }
  };

  async function request(path, body, token, method = 'POST', cleanup = false) {
    const controller = new AbortController();
    if (!cleanup) controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(origin + path, { method, mode: 'same-origin', credentials: 'omit',
        cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', keepalive: cleanup,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify(body), signal: controller.signal });
      if (method === 'DELETE' && response.status === 204) return { status: 204, body: null };
      return { status: response.status, body: await readJson(response) };
    } finally { clearTimeout(timer); controllers.delete(controller); }
  }

  function releaseRemote(value) {
    if (value) void request(HTTP_PATHS.session, {}, value.token, 'DELETE', true).catch(() => {});
    // Best effort only. Lost creation/deletion responses are bounded by server TTL.
  }

  function settle(entry, outcome) {
    if (!current(entry)) return;
    if (outcome.accepted === true && entry.prepared) guideSession = entry.prepared.session;
    pending = null;
    emit(outcome.status);
    entry.resolve(outcome);
  }

  function validateResult(body, entry) {
    const valid = validateHttpResult(body, entry.request);
    if (!valid) return null;
    if (validatePreparedResult) {
      try {
        if (validatePreparedResult(valid, entry.request, entry.prepared.reply, entry.prepared.providerReply ?? null) !== true) return null;
      } catch { return null; }
    }
    return valid;
  }

  function uncertain(entry, status, text) {
    if (!current(entry)) return;
    entry.uncertain = true;
    emit(status, text, true);
    // Keep the original UI turn pending. Only a validated reconciliation may
    // advance its summary; a lost HTTP response proves neither success nor failure.
  }

  async function dispatch(entry) {
    if (!session) {
      try {
        const result = await request(HTTP_PATHS.sessions, {});
        const created = result.status === 201 ? validateHttpSession(result.body) : null;
        if (!current(entry)) { releaseRemote(created); return; }
        if (!created) { settle(entry, localOutcome('unavailable')); return; }
        session = created;
      } catch {
        settle(entry, localOutcome('unavailable'));
        return;
      }
    }
    if (!current(entry)) return;
    entry.session = session;
    entry.request = validateConversationRequest({ schema: CONVERSATION_SCHEMA, conversationId: session.conversationId,
      messageId: id(), locale: 'pt-BR', input: entry.input });
    if (!entry.request) { settle(entry, localOutcome('transport_rejected')); return; }
    emit('sending');
    try {
      const result = await request(HTTP_PATHS.messages, entry.request, entry.session.token);
      if (!current(entry)) return;
      const valid = result.status === 200 ? validateResult(result.body, entry) : null;
      if (valid) {
        if (valid.status === 'unknown') uncertain(entry, 'unknown', valid.response.text);
        else settle(entry, httpResultToOutcome(valid));
        return;
      }
      const error = validateHttpError(result.body);
      if (error && result.status >= 400 && result.status < 500) {
        blocked = true;
        // A session can expire after dispatch but before delivery. A 401 must
        // not be presented as proof that the original message never ran.
        settle(entry, localOutcome(result.status === 401 && error.code === 'unauthorized' ? 'closed' : 'transport_rejected'));
        return;
      }
      throw new Error('Unconfirmed response.');
    } catch {
      uncertain(entry, 'transport_unknown', 'A comunicação terminou sem confirmar o resultado. Consulte a mesma mensagem; nenhuma nova tentativa foi enviada.');
    }
  }

  function send(input) {
    if (!live || blocked) return Promise.resolve(localOutcome('closed'));
    if (pending) return Promise.resolve(localOutcome('busy'));
    // Validate the closed wire input first. R07's two confirmation actions are
    // intentionally unknown to the legacy R03 preflight and must reach the
    // trusted R07 host policy instead of being misclassified as invalid_input.
    const safe = validateConversationRequest({ schema: CONVERSATION_SCHEMA, conversationId: 'preflight',
      messageId: 'preflight', locale: 'pt-BR', input });
    // Never inspect an invalid visitor object with the legacy policy. A closed,
    // empty placeholder preserves its local refusal behavior without getters.
    const preflightInput = safe?.input ?? Object.freeze({ type: 'text', text: '' });
    const preflight = respond(createSession(), preflightInput);
    const trustedLocalAction = safe?.input.type === 'action' &&
      (['confirm_goal', 'cancel_goal'].includes(safe.input.id) || safe.input.id.startsWith('r08:'));
    if (blockedIntents.has(preflight.reply.intent) && !trustedLocalAction) {
      // R15: a private message is refused locally, without a POST. If the
      // server-authoritative R08 flow is already awaiting a service choice,
      // keep its two fixed controls visible so the visitor can cancel/confirm.
      // Never call prepareTurn with sensitive text or forward it to a provider.
      const inPendingQualification = safe?.input.type === 'text' &&
        guideSession?.version === 'faisca-qualification-journey-r08-1' &&
        guideSession.phase === 'service_change_pending';
      const reply = inPendingQualification
        ? Object.freeze({ ...preflight.reply, actions: Object.freeze([
            Object.freeze({ id: 'confirm_goal', label: 'Confirmar a troca' }),
            Object.freeze({ id: 'cancel_goal', label: 'Manter a solução atual' })
          ]) })
        : preflight.reply;
      return Promise.resolve(Object.freeze({
        status: 'answered', delivery: 'guided_fallback', accepted: true,
        reason: preflight.reply.intent, reply,
        mode: 'simulated_lab', operationalEffects: false
      }));
    }
    if (!safe) return Promise.resolve(localOutcome('transport_rejected'));
    let resolve;
    const promise = new Promise(yes => { resolve = yes; });
    let prepared = null;
    if (prepareTurn) {
      try { prepared = prepareTurn(guideSession, safe.input); }
      catch { return Promise.resolve(localOutcome('transport_rejected')); }
      if (!prepared?.reply || !prepared?.session) return Promise.resolve(localOutcome('transport_rejected'));
    }
    const entry = { generation, input: safe.input, request: null, session: null, prepared, resolve, uncertain: false, reconciling: false };
    pending = entry;
    emit('connecting');
    void dispatch(entry).catch(() => {
      if (entry.request) uncertain(entry, 'transport_unknown', 'Não foi possível confirmar esta mensagem. Consulte o resultado ou reinicie a conversa.');
      else settle(entry, localOutcome('unavailable'));
    });
    return promise;
  }

  async function reconcile() {
    const entry = pending;
    if (!entry || !current(entry) || !entry.uncertain || entry.reconciling) return null;
    entry.reconciling = true;
    emit('reconciling', 'Consultando o resultado da mesma mensagem…');
    try {
      const result = await request(HTTP_PATHS.reconcile, entry.request, entry.session.token);
      if (!current(entry)) return null;
      const valid = result.status === 200 ? validateResult(result.body, entry) : null;
      if (valid) {
        if (['unknown', 'not_found'].includes(valid.status)) {
          uncertain(entry, 'unknown', valid.status === 'not_found'
            ? 'Ainda não foi encontrado um resultado para esta mensagem. Você pode consultar novamente ou reiniciar. Nenhuma nova tentativa foi enviada.'
            : 'A resposta continua sem confirmação. Nenhuma nova tentativa foi enviada.');
          return httpResultToOutcome(valid);
        }
        const outcome = httpResultToOutcome(valid);
        settle(entry, outcome);
        return outcome;
      }
      const error = validateHttpError(result.body);
      if (result.status === 401 && error?.code === 'unauthorized') {
        blocked = true;
        const outcome = localOutcome('closed');
        settle(entry, outcome);
        return outcome;
      }
      throw new Error('Unconfirmed reconciliation.');
    } catch {
      uncertain(entry, 'transport_unknown', 'A consulta não confirmou o resultado. Você pode consultar novamente ou reiniciar. A mensagem não foi reenviada.');
      return null;
    } finally { entry.reconciling = false; }
  }

  function release(closing) {
    if (!live) return;
    generation++;
    if (closing) live = false;
    for (const controller of controllers) controller.abort();
    controllers.clear();
    pending?.resolve(localOutcome('closed'));
    pending = null;
    const old = session;
    session = null;
    guideSession = createGuideSession();
    blocked = false;
    releaseRemote(old);
    emit(closing ? 'closed' : 'idle');
  }

  return Object.freeze({ replyAdapter: Object.freeze({ send, reset: () => release(false), destroy: () => release(true) }), reconcile });
}

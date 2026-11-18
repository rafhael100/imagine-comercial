import { createSession, respond, getWelcome } from './core.mjs';
import { validateConversationRequest, conversationFingerprint, createConversationResponse,
  validateConversationResponse, conversationResponseToReply } from './conversation-contract.mjs';

// These records are volatile and local. They do not reserve money, authenticate
// tenants, authorize effects or protect a real distributed API from abuse.
const notices = Object.freeze({
  unavailable: 'O provedor simulado está indisponível. Continuo com a orientação guiada local.',
  provider_limit: 'O limite do provedor simulado foi atingido. Continuo com a orientação guiada local.',
  invalid_response: 'A resposta do provedor simulado não passou na validação. Continuo com a orientação guiada local.',
  unknown: 'O provedor simulado ainda não confirmou uma resposta. Nenhuma nova tentativa foi enviada. Enquanto isso, esta é a orientação guiada local.',
  busy: 'Uma resposta anterior ainda está sem confirmação. Aguarde ou reinicie a demonstração; nenhuma nova chamada foi enviada.',
  conflict: 'Esta identificação de mensagem já foi usada para outro conteúdo. Nenhuma nova chamada foi enviada.',
  limit: 'O limite desta demonstração local foi atingido. Reinicie a conversa para continuar.',
  invalid_request: 'Não consegui validar esta mensagem. Escolha uma das opções para continuar.',
  cancelled: 'A mensagem foi cancelada antes do envio ao provedor simulado.',
  closed: 'Esta conversa de laboratório foi encerrada.',
  not_found: 'Não há registro desta mensagem para conciliar.'
});
const notForwarded = new Set(['sensitive_input', 'unsupported_instruction', 'invalid_input', 'too_long', 'invalid_session',
  'grounding_navigation', 'grounding_boundary', 'grounding_unsupported', 'grounding_ambiguous',
  'journey_confirmation_needed', 'journey_cancelled', 'journey_no_pending',
  'journey_confirmation_refused', 'journey_invalid']);
const readSignalAborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted').get;
const addSignalListener = EventTarget.prototype.addEventListener;
const removeSignalListener = EventTarget.prototype.removeEventListener;

// Validate before reserving any message. Duck-typed EventTargets cannot stand
// in for AbortSignal, and caller accessors must not run during cancellation.
function readSignalOptions(options) {
  try {
    if (!options || typeof options !== 'object' || Array.isArray(options) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(options))) return null;
    if (Reflect.ownKeys(options).some(key => key !== 'signal')) return null;
    const descriptor = Object.getOwnPropertyDescriptor(options, 'signal');
    if (descriptor && !Object.hasOwn(descriptor, 'value')) return null;
    const signal = descriptor?.value;
    if (signal === undefined || signal === null) return { signal: null, isAborted: () => false };
    readSignalAborted.call(signal); // Native brand check; never signal.aborted.
    return { signal, isAborted: () => readSignalAborted.call(signal) };
  } catch { return null; }
}

export function createConversationOutcome(status, { reply = getWelcome(), accepted = false, delivery = 'none', reason = status } = {}) {
  const prefix = notices[status];
  const safeReply = prefix ? Object.freeze({ ...reply, text: prefix + (accepted ? '\n\n' + reply.text : ''),
    state: status === 'unknown' || status === 'busy' ? 'WAIT' : 'ERROR', intent: status }) : reply;
  return Object.freeze({ status, delivery, accepted, reason, reply: safeReply,
    mode: 'simulated_lab', operationalEffects: false });
}
const outcome = createConversationOutcome;

export function createConversationRuntime({ provider, timeoutMs = 250, maxEntries = 64, prepareTurn = respond } = {}) {
  if (!provider || provider.kind !== 'simulated' || typeof provider.respond !== 'function' ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000 ||
      !Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 256 ||
      typeof prepareTurn !== 'function') throw new TypeError('Invalid laboratory conversation runtime.');
  const entries = new Map();
  const conversations = new Map();
  let live = true;
  let dispatched = 0;
  const keyOf = request => JSON.stringify([request.conversationId, request.messageId]);

  function settle(entry, result) {
    if (!live || entry.final) return;
    entry.final = result;
    entry.pending = false;
    clearTimeout(entry.timer);
    entry.cleanup?.();
    const state = conversations.get(entry.conversationId);
    if (state?.active === entry) state.active = null;
    // Unknown is stable for send/replay. Only reconcile exposes late resolution.
    if (!entry.initial) { entry.initial = result; entry.resolve(result); }
  }

  function markUnknown(entry, reason) {
    if (!live || entry.initial || entry.final) return;
    entry.initial = outcome('unknown', { reply: entry.guide, accepted: true, delivery: 'unknown', reason });
    clearTimeout(entry.timer);
    entry.cleanup?.();
    entry.resolve(entry.initial);
  }

  async function send(value, options = {}) {
    if (!live) return outcome('closed');
    const cancellation = readSignalOptions(options);
    if (!cancellation) return outcome('invalid_request', { reason: 'invalid_signal' });
    const { signal, isAborted } = cancellation;
    const request = validateConversationRequest(value);
    if (!request) return outcome('invalid_request');
    const key = keyOf(request);
    if (isAborted() && !entries.has(key)) return outcome('cancelled');
    let fingerprint;
    try { fingerprint = await conversationFingerprint(request); }
    catch { return outcome('unavailable'); }
    if (!live) return outcome('closed');
    const previous = entries.get(key);
    if (previous) {
      if (previous.fingerprint !== fingerprint) return outcome('conflict');
      return previous.initial || previous.promise;
    }
    if (isAborted()) return outcome('cancelled');
    if (entries.size >= maxEntries) return outcome('limit');
    const state = conversations.get(request.conversationId) || { session: createSession(), active: null };
    if (state.active?.pending) return outcome('busy');
    // A checked-in host policy prepares the candidate; visitor messages never
    // select the policy, corpus or provider. The R03 default remains unchanged.
    const guideResult = prepareTurn(state.session, request.input);
    state.session = guideResult.session;
    conversations.set(request.conversationId, state);
    let resolve;
    const promise = new Promise(yes => { resolve = yes; });
    const entry = { fingerprint, conversationId: request.conversationId, guide: guideResult.reply,
      promise, resolve, initial: null, final: null, pending: false, timer: null, cleanup: null };
    entries.set(key, entry);
    if (notForwarded.has(guideResult.reply.intent)) {
      settle(entry, outcome('answered', { reply: guideResult.reply, accepted: true, delivery: 'guided_fallback', reason: guideResult.reply.intent }));
      return entry.initial;
    }
    const candidate = createConversationResponse(request, guideResult.reply);
    entry.pending = true;
    state.active = entry;
    if (signal) {
      const onAbort = () => markUnknown(entry, 'cancelled_after_dispatch');
      addSignalListener.call(signal, 'abort', onAbort, { once: true });
      entry.cleanup = () => removeSignalListener.call(signal, 'abort', onAbort);
    }
    entry.timer = setTimeout(() => markUnknown(entry, 'timeout_after_dispatch'), timeoutMs);
    // The candidate is trusted local guidance; no browser-supplied session,
    // authority, tools, source choice or provider choice enters this request.
    let work;
    dispatched += 1;
    try { work = provider.respond(request, Object.freeze({ candidate })); }
    catch (error) { work = Promise.reject(error); }
    Promise.resolve(work).then(value => {
      if (!live) return;
      const response = validateConversationResponse(value, request);
      // In this simulated phase, even schema-valid prose must be the exact
      // reviewed candidate. A known source ID alone does not make a claim true.
      // A future real-model adapter requires its own reviewed grounding policy.
      const matchesCandidate = response && JSON.stringify(response) === JSON.stringify(candidate);
      settle(entry, matchesCandidate ? outcome('answered', { reply: conversationResponseToReply(response), accepted: true, delivery: 'simulated' })
        : outcome('invalid_response', { reply: entry.guide, accepted: true, delivery: 'guided_fallback' }));
    }, error => {
      if (!live) return;
      let code;
      try { code = Object.getOwnPropertyDescriptor(error, 'code')?.value; } catch { /* Unknown rejection stays generic. */ }
      // A started process with no trustworthy result is still unresolved.
      // Keep its reservation and block redispatch until reset/expiry; a closed
      // pipe or hard deadline does not establish what happened after dispatch.
      if (code === 'provider_unknown') { markUnknown(entry, 'provider_unknown'); return; }
      const status = code === 'provider_limit' ? 'provider_limit' : 'unavailable';
      settle(entry, outcome(status, { reply: entry.guide, accepted: true, delivery: 'guided_fallback' }));
    });
    return promise;
  }

  async function reconcile(value) {
    if (!live) return outcome('closed');
    const request = validateConversationRequest(value);
    if (!request) return outcome('invalid_request');
    let fingerprint;
    try { fingerprint = await conversationFingerprint(request); } catch { return outcome('unavailable'); }
    if (!live) return outcome('closed');
    const entry = entries.get(keyOf(request));
    if (!entry) return outcome('not_found');
    if (entry.fingerprint !== fingerprint) return outcome('conflict');
    if (entry.final) return entry.final;
    return entry.initial || outcome('unknown', { reply: entry.guide, accepted: true, delivery: 'unknown', reason: 'pending' });
  }

  function destroy() {
    if (!live) return;
    live = false;
    for (const entry of entries.values()) {
      clearTimeout(entry.timer);
      entry.cleanup?.();
      if (!entry.initial) entry.resolve(outcome('closed'));
      entry.guide = null;
    }
    entries.clear();
    conversations.clear();
    // This releases only this local simulated provider's timers.
    // It makes no claim about cancellation or cost of any real provider.
    try { provider.dispose?.(); } catch { /* Local teardown is still complete. */ }
  }

  const inspect = () => Object.freeze({ mode: 'simulated_lab', live, entries: entries.size,
    conversations: conversations.size, dispatched, pending: [...entries.values()].filter(entry => entry.pending).length,
    unknown: [...entries.values()].filter(entry => entry.initial?.status === 'unknown' && !entry.final).length });
  return Object.freeze({ send, reconcile, destroy, inspect });
}

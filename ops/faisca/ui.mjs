import { createSession, respond, getWelcome, getSummary, getCapabilities } from './core.mjs';

// Importing this module has no side effect. The host owns mount/destroy.
// Replies are local and deterministic; no network or persistence is performed.
const mountedFaiscaRoots = new WeakMap();
let faiscaInstanceSequence = 0;

function instanceElements(root) {
  const document = root.ownerDocument;
  const elements = new Map();
  const identified = [...root.querySelectorAll('[id]')];
  for (const element of identified) {
    const original = element.getAttribute('data-faisca-id') || element.id;
    if (elements.has(original)) throw new Error('Duplicate ID within Faísca root: ' + original);
    elements.set(original, element);
  }
  const required = ['faisca-chat', 'faisca-log', 'faisca-quick-actions', 'faisca-input',
    'faisca-send', 'faisca-thinking', 'faisca-launcher', 'faisca-closed', 'faisca-motion',
    'faisca-summary', 'faisca-summary-text', 'faisca-feedback', 'faisca-summary-indicator',
    'faisca-copy-status', 'faisca-count', 'faisca-master', 'faisca-minimize',
    'faisca-reset', 'faisca-composer', 'faisca-copy', 'chat-title'];
  for (const id of required) if (!elements.has(id)) throw new Error('Incomplete Faísca root: ' + id);
  if (root.querySelectorAll('.hero-story').length !== 1) throw new Error('Faísca requires one hero story per root.');
  const documentIds = [...document.querySelectorAll('[id]')];
  const collisions = identified.some(element => documentIds.some(other => other !== element && other.id === element.id));
  let prefix = '';
  if (collisions) {
    do { prefix = 'faisca-r02-' + (++faiscaInstanceSequence) + '-'; }
    while ([...elements.keys()].some(id => document.getElementById(prefix + id)));
  }
  const replacements = new Map();
  for (const [original, element] of elements) {
    const next = prefix ? prefix + original : element.id;
    replacements.set(element.id, next);
    replacements.set(original, next);
    element.setAttribute('data-faisca-id', original);
    element.id = next;
  }
  for (const element of root.querySelectorAll('[for],[aria-labelledby],[aria-describedby],[aria-controls],[aria-details],[href]')) {
    for (const name of ['for', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-details']) {
      if (element.hasAttribute(name)) element.setAttribute(name, element.getAttribute(name)
        .split(/\s+/).map(id => replacements.get(id) || id).join(' '));
    }
    const href = element.getAttribute('href');
    if (href?.startsWith('#') && replacements.has(href.slice(1))) element.setAttribute('href', '#' + replacements.get(href.slice(1)));
  }
  return elements;
}

/** Mount one guided conversation. Repeated mounting returns the existing API. */
export function mountFaisca(root, config = {}) {
  if (!root || root.nodeType !== 1 || !root.ownerDocument?.defaultView || !root.hasAttribute('data-faisca-root')) {
    throw new TypeError('mountFaisca requires an element with data-faisca-root.');
  }
  const mounted = mountedFaiscaRoots.get(root);
  if (mounted) return mounted;
  if (root.querySelector('[data-faisca-root]') || root.parentElement?.closest('[data-faisca-root]')) {
    throw new Error('Nested Faísca roots are not supported.');
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new TypeError('Invalid Faísca configuration.');
  const descriptors = Object.getOwnPropertyDescriptors(config);
  if (Reflect.ownKeys(descriptors).some(key => !['replyDelayMs', 'replyAdapter', 'prepareTurn', 'sessionPolicy'].includes(key) || !Object.hasOwn(descriptors[key], 'value'))) {
    throw new TypeError('Only local reply timing and a trusted laboratory adapter can be configured.');
  }
  // Optional, checked-in R07 local policy; public and legacy demos retain the original session.
  const sessionPolicy = descriptors.sessionPolicy?.value ?? null;
  if (sessionPolicy !== null) {
    if (!sessionPolicy || typeof sessionPolicy !== 'object' || Array.isArray(sessionPolicy) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(sessionPolicy))) throw new TypeError('Invalid local session policy.');
    const fields = Object.getOwnPropertyDescriptors(sessionPolicy);
    const names = Reflect.ownKeys(fields);
    if (names.length < 2 || names.length > 6 ||
        names.some(key => typeof key !== 'string' ||
          !['create', 'summary', 'quoteSite', 'welcome', 'actionLimit', 'textInputEnabled'].includes(key)) ||
        ['create', 'summary'].some(key => !fields[key] ||
          !Object.hasOwn(fields[key], 'value') || typeof fields[key].value !== 'function') ||
        (fields.quoteSite && (!Object.hasOwn(fields.quoteSite, 'value') ||
          typeof fields.quoteSite.value !== 'function')) ||
         (fields.welcome && (!Object.hasOwn(fields.welcome, 'value') ||
          typeof fields.welcome.value !== 'function')) ||
        (fields.actionLimit && (!Object.hasOwn(fields.actionLimit, 'value') ||
          fields.actionLimit.value !== 7)) ||
        (fields.textInputEnabled && (!Object.hasOwn(fields.textInputEnabled, 'value') ||
          fields.textInputEnabled.value !== false))) {
      throw new TypeError('Incomplete local session policy.');
    }
  }
  const createSessionForView = sessionPolicy?.create ?? createSession;
  const getSummaryForView = sessionPolicy?.summary ?? getSummary;
  // R53: only checked-in isolated laboratory policies may replace the welcome.
  // Default public and legacy demos keep the original Faísca greeting.
  const getWelcomeForView = sessionPolicy?.welcome ?? getWelcome;
  // A vetted, locally injected support policy can remove free-text controls.
  // This is a UI guard; the support turn policy also rejects typed content.
  const textInputEnabled = sessionPolicy?.textInputEnabled !== false;
  const replyDelayMs = descriptors.replyDelayMs?.value ?? 220;
  const prepareTurn = descriptors.prepareTurn?.value ?? respond;
  if (typeof prepareTurn !== 'function') throw new TypeError('Invalid trusted turn policy.');
  if (!Number.isInteger(replyDelayMs) || replyDelayMs < 0 || replyDelayMs > 2000) throw new TypeError('Invalid replyDelayMs.');
  // The optional adapter is supplied by checked-in laboratory code, never by a
  // visitor envelope, DOM URL or public page. Standalone remains guided-only.
  const replyAdapter = descriptors.replyAdapter?.value ?? null;
  if (replyAdapter !== null) {
    if (typeof replyAdapter !== 'object' || Array.isArray(replyAdapter)) throw new TypeError('Invalid laboratory adapter.');
    const methods = Object.getOwnPropertyDescriptors(replyAdapter);
    const names = ['send', 'reset', 'destroy'];
    if (Reflect.ownKeys(methods).some(key => !names.includes(key)) ||
        names.some(key => !Object.hasOwn(methods, key) || !Object.hasOwn(methods[key], 'value') || typeof methods[key].value !== 'function')) {
      throw new TypeError('Incomplete laboratory adapter.');
    }
  }
  const document = root.ownerDocument;
  const window = document.defaultView;
  const navigator = window.navigator;
  const elements = instanceElements(root);
  const byId = id => elements.get(id);
  const shell = byId('faisca-chat');
  const log = byId('faisca-log');
  const actions = byId('faisca-quick-actions');
  const input = byId('faisca-input');
  const send = byId('faisca-send');
  const composer = byId('faisca-composer');
  const originalComposerHidden = composer.hidden;
  const originalInputDisabled = input.disabled;
  const originalSendDisabled = send.disabled;
  const thinking = byId('faisca-thinking');
  const launcher = byId('faisca-launcher');
  const closed = byId('faisca-closed');
  const motion = byId('faisca-motion');
  const summary = byId('faisca-summary');
  const summaryText = byId('faisca-summary-text');
  const feedback = byId('faisca-feedback');
  const story = root.querySelector('.hero-story');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const originalRootAttributes = new Map(['data-motion', 'data-page-hidden', 'data-faisca-mode', 'data-faisca-mounted', 'data-faisca-status', 'data-faisca-delivery']
    .map(name => [name, root.getAttribute(name)]));
  const cleanups = [];
  let alive = true;
  let session = createSessionForView();
  let generation = 0;
  let summaryRevision = 0;
  let timer = null;
  let pending = null;
  let lastOpener = null;
  let manuallyPaused = false;

  const on = (target, type, callback) => {
    const listener = event => { if (alive) callback(event); };
    target.addEventListener(type, listener);
    cleanups.push(() => target.removeEventListener(type, listener));
  };

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text === 'string') element.textContent = text;
    return element;
  };
  const announce = (text) => { feedback.textContent = text; };
  const setState = (state) => { story.dataset.state = state; shell.dataset.state = state; };
  const safeReply = () => ({ text: 'Não consegui preparar essa orientação. Podemos recomeçar ou escolher uma das jornadas.', actions: [{ id: 'home', label: 'Ver as jornadas' }], sources: [], state: 'ERROR', intent: 'ui_unavailable' });
  const normalizeReply = (value) => value && typeof value.text === 'string' && Array.isArray(value.actions) && Array.isArray(value.sources) ? value : safeReply();

  function appendMessage(role, text, sources = []) {
    if (!alive || typeof text !== 'string' || !text.trim()) return;
    const item = make('article', `chat-message ${role}`);
    item.append(make('span', 'message-author', role === 'user' ? 'VOCÊ' : 'FAÍSCA'));
    item.append(make('p', 'message-body', text));
    if (role !== 'user' && sources.length) {
      const details = make('details', 'message-sources');
      details.append(make('summary', '', 'Base desta orientação'));
      const list = make('ul');
      for (const source of sources) {
        if (source && typeof source.title === 'string') list.append(make('li', '', source.title));
      }
      details.append(list);
      item.append(details);
    }
    log.append(item);
    // Keep the visible conversation bounded; nothing is stored beyond this page.
    while (log.children.length > 40) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  function renderActions(items) {
    actions.replaceChildren();
    // Support triage may have 6 choices plus one safe correction button.
    // Other journeys retain their original six-action limit.
    for (const item of items.slice(0, sessionPolicy?.actionLimit === 7 ? 7 : 6)) {
      if (!item || typeof item.id !== 'string' || typeof item.label !== 'string') continue;
      const button = make('button', '', item.label);
      button.type = 'button';
      button.dataset.actionId = item.id;
      actions.append(button);
    }
  }

  function refreshSummary() {
    summaryRevision += 1;
    const text = getSummaryForView(session);
    summaryText.value = typeof text === 'string' ? text : '';
    // R37: expose ONLY a validated, completed service enum for the
    // opt-in private quote preview. Never publish the profile, contact
    // choice, free text, audience or any price in DOM attributes.
    // R37: only the trusted R08 host policy may provide a COMPLETED service.
    // The generic R02 UI must keep its single original core import so the
    // audited standalone offline demonstrator remains self-contained.
    let quoteSite = null;
    try { quoteSite = sessionPolicy?.quoteSite?.(session) ?? null; }
    catch { /* No trusted status on callback failure. */ }
    if (quoteSite === 'onepage' || quoteSite === 'landing-pages') {
      root.dataset.faiscaQuoteSite = quoteSite;
    } else {
      delete root.dataset.faiscaQuoteSite;
    }
    const hasSelection = Array.isArray(session.selection) && session.selection.length > 0;
    const hasContext = hasSelection || session.goal !== null || session.supportTopic !== null;
    const prompts = { sell: 'Escolha seu objetivo', after_sales: 'Escolha o assunto', faq: 'Explorando dúvidas', human: 'Preparar atendimento', start: 'Comece uma jornada' };
    byId('faisca-summary-indicator').textContent = hasContext ? 'Atualizado' : prompts[session.journey] || 'Comece uma jornada';
    byId('faisca-copy-status').textContent = '';
  }

  function setBusy(value) {
    send.disabled = value || !textInputEnabled;
    for (const button of actions.querySelectorAll('button')) button.disabled = value;
    thinking.hidden = !value;
    log.setAttribute('aria-busy', String(value));
    if (value) setState('THINK');
  }

  function focusPrimaryControl() {
    const control = textInputEnabled ? input : actions.querySelector('button');
    control?.focus({ preventScroll: true });
  }

  function finishPending() {
    if (!alive || !pending || !pending.ready) return;
    const focusWasInActions = actions.contains(document.activeElement);
    const result = pending.result;
    pending = null;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    session = result.session;
    const reply = normalizeReply(result.reply);
    setBusy(false);
    appendMessage('assistant', reply.text, reply.sources);
    renderActions(reply.actions);
    setState(shell.hidden ? 'SLEEP' : reply.state || 'TALK');
    refreshSummary();
    if (focusWasInActions && !shell.hidden) focusPrimaryControl();
  }

  function turn(event) {
    if (!alive || pending) return;
    summaryRevision += 1;
    byId('faisca-copy-status').textContent = '';
    let result;
    try { result = prepareTurn(session, event); }
    catch { result = { session, reply: safeReply(), userText: '' }; }
    if (!result || !result.session || !result.reply) result = { session, reply: safeReply(), userText: '' };
    // Only the core's vetted echo reaches the conversation. Raw input is never echoed.
    if (typeof result.userText === 'string') appendMessage('user', result.userText);
    input.value = '';
    byId('faisca-count').textContent = '0/800';
    const current = { result, ready: !replyAdapter };
    pending = current;
    const ownGeneration = generation;
    setBusy(true);
    if (replyAdapter) {
      Promise.resolve().then(() => {
        if (!alive || ownGeneration !== generation || pending !== current) return null;
        return replyAdapter.send(event);
      }).then(outcome => {
        if (!alive || ownGeneration !== generation || pending !== current) return;
        current.result = {
          session: outcome?.accepted === true ? result.session : session,
          reply: normalizeReply(outcome?.reply)
        };
        root.dataset.faiscaStatus = typeof outcome?.status === 'string' ? outcome.status : 'invalid_response';
        root.dataset.faiscaDelivery = typeof outcome?.delivery === 'string' ? outcome.delivery : 'none';
        current.ready = true;
        finishPending();
      }).catch(() => {
        if (!alive || ownGeneration !== generation || pending !== current) return;
        current.result = { session, reply: safeReply() };
        current.ready = true;
        root.dataset.faiscaStatus = 'adapter_unavailable';
        root.dataset.faiscaDelivery = 'none';
        finishPending();
      });
      return;
    }
    timer = window.setTimeout(() => {
      if (!alive || ownGeneration !== generation || !pending) return;
      finishPending();
    }, reduceMotion.matches ? 0 : replyDelayMs);
  }

  function openChat(opener, focusInput = true) {
    if (!alive) return;
    if (opener && opener !== launcher && root.contains(opener)) lastOpener = opener;
    const wasClosed = shell.hidden;
    shell.hidden = false;
    closed.hidden = true;
    launcher.hidden = true;
    launcher.setAttribute('aria-expanded', 'true');
    log.setAttribute('aria-live', 'polite');
    if (wasClosed) setState('IDLE');
    if (focusInput) {
      shell.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'instant' : 'smooth' });
      focusPrimaryControl();
    }
  }

  function closeChat() {
    if (!alive) return;
    log.setAttribute('aria-live', 'off');
    shell.hidden = true;
    closed.hidden = false;
    launcher.hidden = false;
    launcher.setAttribute('aria-expanded', 'false');
    // Complete only the local pending turn while hidden, without a live announcement.
    finishPending();
    setState('SLEEP');
    if (lastOpener && root.contains(lastOpener) && !lastOpener.closest('[hidden]')) lastOpener.focus();
    else launcher.focus();
  }

  function resetConversation() {
    if (!alive) return;
    generation += 1;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    pending = null;
    try { replyAdapter?.reset(); } catch { /* Local guidance must stay usable. */ }
    delete root.dataset.faiscaStatus;
    delete root.dataset.faiscaDelivery;
    session = createSessionForView();
    log.replaceChildren();
    input.value = '';
    byId('faisca-count').textContent = '0/800';
    summary.open = false;
    setBusy(false);
    const welcome = normalizeReply(getWelcomeForView());
    appendMessage('assistant', welcome.text, welcome.sources);
    renderActions(welcome.actions);
    refreshSummary();
    setState(shell.hidden ? 'SLEEP' : 'IDLE');
    announce('Conversa reiniciada. O histórico anterior foi apagado desta página.');
    if (!shell.hidden) focusPrimaryControl();
  }

  function updateMotion() {
    if (!alive) return;
    const paused = manuallyPaused || reduceMotion.matches;
    root.dataset.motion = paused ? 'paused' : 'enabled';
    motion.setAttribute('aria-pressed', String(paused));
    motion.textContent = reduceMotion.matches ? 'Movimento reduzido do sistema' : paused ? 'Ativar movimento' : 'Pausar movimento';
    motion.disabled = reduceMotion.matches;
    motion.title = reduceMotion.matches ? 'A preferência de movimento reduzido do seu dispositivo está sendo respeitada.' : '';
  }

  function destroy() {
    if (!alive) return;
    alive = false;
    generation += 1;
    summaryRevision += 1;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    pending = null;
    try { replyAdapter?.destroy(); } catch { /* Always release the UI lifecycle. */ }
    for (const cleanup of cleanups.splice(0)) cleanup();
    mountedFaiscaRoots.delete(root);
    session = null;
    lastOpener = null;
    const hadFocus = root.contains(document.activeElement);
    log.setAttribute('aria-live', 'off');
    log.replaceChildren();
    actions.replaceChildren();
    input.value = '';
    summaryText.value = '';
    delete root.dataset.faiscaQuoteSite;
    summary.open = false;
    feedback.textContent = '';
    byId('faisca-copy-status').textContent = '';
    byId('faisca-summary-indicator').textContent = '—';
    byId('faisca-count').textContent = '0/800';
    setBusy(false);
    composer.hidden = originalComposerHidden;
    input.disabled = originalInputDisabled;
    send.disabled = originalSendDisabled;
    shell.hidden = false;
    closed.hidden = true;
    launcher.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    for (const node of root.querySelectorAll('[data-js-only]')) node.hidden = true;
    delete shell.dataset.state;
    delete story.dataset.state;
    motion.disabled = false;
    motion.textContent = 'Pausar movimento';
    motion.setAttribute('aria-pressed', 'false');
    motion.removeAttribute('title');
    for (const [name, value] of originalRootAttributes) {
      if (value === null) root.removeAttribute(name); else root.setAttribute(name, value);
    }
    if (hadFocus && root.isConnected) byId('chat-title').focus({ preventScroll: true });
  }

  for (const avatar of root.querySelectorAll('[data-faisca-avatar]')) avatar.src = byId('faisca-master').src;
  on(actions, 'click', event => {
    const button = event.target.closest?.('button[data-action-id]');
    if (button && actions.contains(button) && !button.disabled) turn({ type: 'action', id: button.dataset.actionId });
  });
  for (const button of root.querySelectorAll('[data-demo-action]')) {
    on(button, 'click', () => {
      openChat(button, false);
      if (pending && !pending.ready) {
        announce('Aguarde esta resposta ou reinicie a conversa.');
        focusPrimaryControl();
        return;
      }
      finishPending();
      turn({ type: 'action', id: button.dataset.demoAction });
      shell.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'instant' : 'smooth' });
      focusPrimaryControl();
    });
  }
  for (const button of root.querySelectorAll('[data-open-chat]')) on(button, 'click', () => openChat(button));
  on(launcher, 'click', () => openChat(launcher));
  on(byId('faisca-minimize'), 'click', closeChat);
  on(byId('faisca-reset'), 'click', resetConversation);
  on(motion, 'click', () => { manuallyPaused = !manuallyPaused; updateMotion(); });
  on(reduceMotion, 'change', updateMotion);
  on(document, 'visibilitychange', () => { root.dataset.pageHidden = String(document.hidden); });
  on(shell, 'keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); closeChat(); }
  });
  on(input, 'input', () => { byId('faisca-count').textContent = `${input.value.length}/800`; });
  on(input, 'keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!pending) byId('faisca-composer').requestSubmit();
    }
  });
  on(byId('faisca-composer'), 'submit', (event) => {
    event.preventDefault();
    if (!textInputEnabled) {
      announce('Escolha uma das opções de atendimento.');
      focusPrimaryControl();
      return;
    }
    if (!input.value.trim()) { announce('Escreva uma pergunta ou escolha uma das opções.'); input.focus(); return; }
    turn({ type: 'text', text: input.value });
  });
  on(byId('faisca-copy'), 'click', async () => {
    const text = getSummaryForView(session);
    const status = byId('faisca-copy-status');
    const ownGeneration = generation;
    const ownSummaryRevision = summaryRevision;
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(text);
      if (!alive || ownGeneration !== generation || ownSummaryRevision !== summaryRevision) return;
      status.textContent = 'Resumo copiado. Nenhuma informação foi enviada à Imagine.';
    } catch {
      if (!alive || ownGeneration !== generation || ownSummaryRevision !== summaryRevision) return;
      if (!shell.hidden) { summaryText.focus(); summaryText.select(); }
      status.textContent = 'Resumo selecionado. Use Copiar no seu dispositivo ou Ctrl+C.';
    }
  });
  shell.hidden = false;
  closed.hidden = true;
  launcher.hidden = true;
  log.setAttribute('aria-live', 'polite');
  log.replaceChildren();
  input.value = '';
  composer.hidden = originalComposerHidden || !textInputEnabled;
  input.disabled = originalInputDisabled || !textInputEnabled;
  byId('faisca-count').textContent = '0/800';
  summary.open = false;
  feedback.textContent = '';
  setBusy(false);
  root.dataset.faiscaMode = replyAdapter ? 'simulated_contract_demo' : getCapabilities().mode;
  root.dataset.faiscaMounted = 'true';
  root.dataset.pageHidden = String(document.hidden);
  updateMotion();
  const welcome = normalizeReply(getWelcomeForView());
  appendMessage('assistant', welcome.text, welcome.sources);
  renderActions(welcome.actions);
  refreshSummary();
  setState('IDLE');
  launcher.setAttribute('aria-expanded', 'true');
  // Reveal interaction only after every listener and initial state is installed.
  for (const node of root.querySelectorAll('[data-js-only]')) node.hidden = false;
  const api = Object.freeze({ mode: replyAdapter ? 'simulated_contract_demo' : 'guided_demo', root,
    open: () => openChat(), close: closeChat, reset: resetConversation, destroy });
  mountedFaiscaRoots.set(root, api);
  return api;
}

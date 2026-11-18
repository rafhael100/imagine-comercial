const hosts = new WeakMap();

export function bindHttpLabHost(host, loadModule = () => import('./http-ui.mjs')) {
  const previous = hosts.get(host);
  if (previous) return previous;
  const root = host.querySelector('[data-faisca-root]');
  const start = host.querySelector('[data-faisca-http-start]');
  const status = host.querySelector('[data-faisca-http-status]');
  const consult = host.querySelector('[data-faisca-http-reconcile]');
  const reconciliation = host.querySelector('[data-faisca-http-reconciliation]');
  if (!root || !start || !status || !consult || !reconciliation || typeof loadModule !== 'function') {
    throw new TypeError('Incomplete HTTP laboratory host.');
  }
  let live = true, loading = false, version = 0, revision = 0, instance = null;
  const descriptions = {
    idle: 'Conversa reiniciada. A próxima mensagem abrirá uma nova sessão de laboratório.',
    connecting: 'Preparando a sessão no servidor local…', sending: 'Aguardando a resposta do servidor local…',
    answered: 'Resposta recebida. O provedor deste laboratório é simulado.',
    unavailable: 'O laboratório está indisponível. Confira se o servidor local está ativo.',
    provider_limit: 'O limite simulado foi atingido; a orientação guiada continua disponível.',
    invalid_response: 'A resposta simulada foi rejeitada; a orientação guiada continua disponível.',
    transport_rejected: 'O servidor recusou a mensagem. Reinicie a conversa para continuar.',
    closed: 'A sessão foi encerrada ou expirou. Reinicie a conversa para continuar.'
  };

  async function activate() {
    if (!live || loading || instance) return;
    loading = true;
    const ownVersion = ++version;
    start.disabled = true;
    status.textContent = 'Preparando a conversa de laboratório…';
    try {
      const module = await loadModule();
      if (!live || ownVersion !== version || !host.isConnected) return;
      if (typeof module?.mountFaisca !== 'function') throw new TypeError('HTTP conversation unavailable.');
      instance = module.mountFaisca(root, { onState(state) {
        if (!live || ownVersion !== version || !host.isConnected) return;
        status.dataset.faiscaHttpState = state.status;
        status.textContent = state.text || descriptions[state.status] || 'Conversa de laboratório ativa.';
        consult.disabled = !state.canReconcile;
        if (['idle', 'closed', 'connecting'].includes(state.status)) { revision++; reconciliation.textContent = ''; }
      } });
      if (!instance || ['open', 'destroy', 'reconcile'].some(key => typeof instance[key] !== 'function')) {
        throw new TypeError('Incomplete HTTP lifecycle.');
      }
      instance.open();
      start.hidden = true;
      consult.hidden = false;
      consult.disabled = true;
      status.dataset.faiscaHttpState = 'idle';
      status.textContent = 'Conversa ativa. As mensagens de teste serão enviadas apenas ao servidor local deste laboratório.';
    } catch {
      if (!live || ownVersion !== version || !host.isConnected) return;
      try { instance?.destroy(); } catch { /* Keep activation usable. */ }
      instance = null;
      start.hidden = false;
      consult.hidden = true;
      status.textContent = 'Não foi possível abrir a conversa. As orientações da página continuam disponíveis.';
    } finally {
      if (live && ownVersion === version) { loading = false; start.disabled = false; }
    }
  }

  async function reconcile() {
    if (!live || !instance || consult.disabled) return;
    const ownInstance = instance, ownRevision = revision;
    consult.disabled = true;
    try {
      const result = await ownInstance.reconcile();
      if (!live || instance !== ownInstance || revision !== ownRevision || !host.isConnected || !result) return;
      if (!['unknown', 'not_found'].includes(result.status)) {
        reconciliation.textContent = result.accepted ? 'Resposta conciliada: ' + result.reply.text : result.reply.text;
      }
    } catch { /* Client preserves uncertainty and controls the next consultation. */ }
  }

  function destroy() {
    if (!live) return;
    live = false;
    version++;
    revision++;
    start.removeEventListener('click', activate);
    consult.removeEventListener('click', reconcile);
    try { instance?.destroy(); } catch { /* Always release the host. */ }
    instance = null;
    start.hidden = true;
    start.disabled = false;
    consult.hidden = true;
    consult.disabled = true;
    status.textContent = '';
    delete status.dataset.faiscaHttpState;
    reconciliation.textContent = '';
    hosts.delete(host);
  }

  const api = Object.freeze({ activate, destroy });
  hosts.set(host, api);
  start.addEventListener('click', activate);
  consult.addEventListener('click', reconcile);
  start.hidden = false;
  return api;
}

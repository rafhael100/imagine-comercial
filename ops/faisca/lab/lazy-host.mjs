// A small lifecycle adapter; the conversation module is loaded only on activation.
// A loading promise does not survive disconnect or gain business capabilities.
const hosts = new WeakMap();

export function bindLabHost(host, loadModule = () => import('../ui.mjs')) {
  const previous = hosts.get(host);
  if (previous) return previous;
  const root = host.querySelector('[data-faisca-root]');
  const start = host.querySelector('[data-faisca-lab-start]');
  const feedback = host.querySelector('[data-faisca-lab-status]');
  if (!root || !start || !feedback || typeof loadModule !== 'function') throw new TypeError('Incomplete laboratory host.');
  let live = true;
  let loading = false;
  let version = 0;
  let instance = null;

  async function activate() {
    if (!live || loading || instance) return;
    loading = true;
    const ownVersion = ++version;
    start.disabled = true;
    feedback.textContent = 'Preparando a conversa local…';
    try {
      const module = await loadModule();
      if (!live || ownVersion !== version || !host.isConnected) return;
      if (typeof module?.mountFaisca !== 'function') throw new TypeError('Conversation module unavailable.');
      instance = module.mountFaisca(root);
      if (!instance || typeof instance.open !== 'function' || typeof instance.destroy !== 'function') {
        throw new TypeError('Incomplete conversation lifecycle API.');
      }
      instance.open();
      start.hidden = true;
      feedback.textContent = 'Demonstração ativa. As respostas continuam locais.';
    } catch {
      if (!live || ownVersion !== version || !host.isConnected) return;
      try { if (typeof instance?.destroy === 'function') instance.destroy(); } catch { /* Keep retry usable. */ }
      instance = null;
      start.hidden = false;
      feedback.textContent = 'Não foi possível abrir a conversa. Você pode tentar novamente; as orientações da página continuam disponíveis.';
    } finally {
      if (live && ownVersion === version) {
        loading = false;
        start.disabled = false;
      }
    }
  }

  function destroy() {
    if (!live) return;
    live = false;
    version += 1;
    start.removeEventListener('click', activate);
    try { if (typeof instance?.destroy === 'function') instance.destroy(); } catch { /* Teardown must still release the host. */ }
    instance = null;
    start.disabled = false;
    start.hidden = true;
    feedback.textContent = '';
    hosts.delete(host);
  }

  const api = Object.freeze({ activate, destroy });
  hosts.set(host, api);
  start.addEventListener('click', activate);
  start.hidden = false;
  return api;
}

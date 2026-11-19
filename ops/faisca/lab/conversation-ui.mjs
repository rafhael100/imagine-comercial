import { mountFaisca as mountGuidedFaisca } from '../ui.mjs';
import { CONVERSATION_SCHEMA } from '../conversation-contract.mjs';
import { createConversationRuntime } from '../conversation-runtime.mjs';
import { createSimulatedProvider } from '../simulated-provider.mjs';

// This adapter exists only in the explicitly enabled static laboratory.
// It never receives a provider URL, credentials or visitor-granted authority.
const SCENARIOS = new Set(['success', 'unavailable', 'limit', 'timeout', 'malformed']);
const instances = new WeakMap();
const opaqueId = () => globalThis.crypto.randomUUID().replaceAll('-', '');

export function createLabReplyAdapter(scenario = 'success') {
  if (!SCENARIOS.has(scenario)) throw new TypeError('Unknown laboratory scenario.');
  let closed = false;
  let conversationId;
  let runtime;
  const active = new Set();

  function create() {
    conversationId = opaqueId();
    runtime = createConversationRuntime({
      provider: createSimulatedProvider({ scenario, delayMs: scenario === 'timeout' ? 800 : 40 }),
      timeoutMs: 250,
      maxEntries: 64
    });
  }

  function release() {
    for (const controller of active) controller.abort();
    active.clear();
    runtime.destroy();
  }

  create();
  return Object.freeze({
    async send(input) {
      const controller = new AbortController();
      const request = { schema: CONVERSATION_SCHEMA, conversationId,
        messageId: opaqueId(), locale: 'pt-BR', input };
      active.add(controller);
      if (closed) controller.abort();
      try { return await runtime.send(request, { signal: controller.signal }); }
      finally { active.delete(controller); }
    },
    reset() {
      if (closed) return;
      release();
      create();
    },
    destroy() {
      if (closed) return;
      closed = true;
      release();
    }
  });
}

export function mountFaisca(root, config = {}) {
  const existing = instances.get(root);
  if (existing && root.hasAttribute('data-faisca-mounted')) return existing;
  const adapter = createLabReplyAdapter(config.scenario ?? 'success');
  let mounted;
  try { mounted = mountGuidedFaisca(root, { replyAdapter: adapter }); }
  catch (error) { adapter.destroy(); throw error; }
  const api = Object.freeze({ ...mounted, destroy() {
    mounted.destroy();
    instances.delete(root);
  } });
  instances.set(root, api);
  return api;
}

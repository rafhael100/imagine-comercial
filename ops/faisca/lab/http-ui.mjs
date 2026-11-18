import { mountFaisca as mountGuidedFaisca } from '../ui.mjs';
import { createHttpConversationClient } from './http-client.mjs';

const instances = new WeakMap();

export function mountFaisca(root, { onState = () => {} } = {}) {
  const existing = instances.get(root);
  if (existing && root.hasAttribute('data-faisca-mounted')) return existing;
  const client = createHttpConversationClient({ origin: root.ownerDocument.defaultView.location.origin, onState });
  let mounted;
  try { mounted = mountGuidedFaisca(root, { replyAdapter: client.replyAdapter }); }
  catch (error) { client.replyAdapter.destroy(); throw error; }
  const api = Object.freeze({ ...mounted, mode: 'loopback_http_lab', reconcile: client.reconcile,
    destroy() { mounted.destroy(); instances.delete(root); } });
  instances.set(root, api);
  return api;
}

import { mountFaisca as mountGuidedFaisca } from '../ui.mjs';
import { createHttpConversationClient } from '../lab/http-client.mjs';
import { groundedRespond } from './guide.mjs';
import { validateGroundedHttpResult } from './http-policy.mjs';

const instances = new WeakMap();

export function mountFaisca(root, { onState = () => {} } = {}) {
  const existing = instances.get(root);
  if (existing && root.hasAttribute('data-faisca-mounted')) return existing;
  const client = createHttpConversationClient({ origin: root.ownerDocument.defaultView.location.origin,
    onState, prepareTurn: groundedRespond, validatePreparedResult: validateGroundedHttpResult });
  let mounted;
  try { mounted = mountGuidedFaisca(root, { replyAdapter: client.replyAdapter, prepareTurn: groundedRespond }); }
  catch (error) { client.replyAdapter.destroy(); throw error; }
  const api = Object.freeze({ ...mounted, mode: 'grounded_http_lab', reconcile: client.reconcile,
    destroy() { mounted.destroy(); instances.delete(root); } });
  instances.set(root, api);
  return api;
}

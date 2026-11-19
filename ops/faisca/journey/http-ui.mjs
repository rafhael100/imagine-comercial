import { mountFaisca as mountGuidedFaisca } from '../ui.mjs';
import { createHttpConversationClient } from '../lab/http-client.mjs';
import { validateGroundedHttpResult } from '../grounding/http-policy.mjs';
import { createJourney, getJourneySummary, respondJourney } from './state.mjs';

const instances = new WeakMap();
const sessionPolicy = Object.freeze({ create: createJourney, summary: getJourneySummary });

/** R07 browser host: server session + PHP grounding, with R07's confirmed-choice state. */
export function mountFaisca(root, { onState = () => {} } = {}) {
  const existing = instances.get(root);
  if (existing && root.hasAttribute('data-faisca-mounted')) return existing;
  const client = createHttpConversationClient({
    origin: root.ownerDocument.defaultView.location.origin,
    onState, prepareTurn: respondJourney, validatePreparedResult: validateGroundedHttpResult,
    createGuideSession: createJourney
  });
  let mounted;
  try {
    mounted = mountGuidedFaisca(root, {
      replyAdapter: client.replyAdapter, prepareTurn: respondJourney, sessionPolicy
    });
  } catch (error) {
    client.replyAdapter.destroy();
    throw error;
  }
  const api = Object.freeze({
    ...mounted, mode: 'r07_http_php_lab', reconcile: client.reconcile,
    destroy() { mounted.destroy(); instances.delete(root); }
  });
  instances.set(root, api);
  root.dataset.faiscaMode = 'r07_http_php_lab';
  return api;
}

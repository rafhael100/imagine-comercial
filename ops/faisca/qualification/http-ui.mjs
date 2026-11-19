import { mountFaisca as mountGuidedFaisca } from '../ui.mjs';
import { createHttpConversationClient } from '../lab/http-client.mjs';
import { validateGroundedHttpResult } from '../grounding/http-policy.mjs';
import { createQualificationJourney, getQualificationSummary, respondQualificationJourney } from './journey.mjs';

const instances = new WeakMap();
const sessionPolicy = Object.freeze({ create: createQualificationJourney, summary: getQualificationSummary });

/** R08 browser host: qualification state per HTTP session + PHP grounding for R07 answers. */
export function mountFaisca(root, { onState = () => {} } = {}) {
  const existing = instances.get(root);
  if (existing && root.hasAttribute('data-faisca-mounted')) return existing;
  const client = createHttpConversationClient({
    origin: root.ownerDocument.defaultView.location.origin,
    onState, prepareTurn: respondQualificationJourney, validatePreparedResult: validateGroundedHttpResult,
    createGuideSession: createQualificationJourney
  });
  let mounted;
  try {
    mounted = mountGuidedFaisca(root, {
      replyAdapter: client.replyAdapter, prepareTurn: respondQualificationJourney, sessionPolicy
    });
  } catch (error) {
    client.replyAdapter.destroy();
    throw error;
  }
  const api = Object.freeze({
    ...mounted, mode: 'r08_http_php_lab', reconcile: client.reconcile,
    destroy() { mounted.destroy(); instances.delete(root); }
  });
  instances.set(root, api);
  root.dataset.faiscaMode = 'r08_http_php_lab';
  return api;
}

import { mountFaisca } from '../ui.mjs';
import {
  createSupportJourney, respondSupportJourney, getSupportJourneySummary
} from './journey.mjs';

const policy = Object.freeze({
  create: createSupportJourney,
  summary: getSupportJourneySummary
});

/** Local-only R10 support: no customer identity, persistence or external calls. */
export function mountSupport(root) {
  const mounted = mountFaisca(root, {
    prepareTurn: respondSupportJourney,
    sessionPolicy: policy,
    replyDelayMs: 110
  });
  root.dataset.faiscaMode = 'r10_anonymous_support_lab';
  return mounted;
}

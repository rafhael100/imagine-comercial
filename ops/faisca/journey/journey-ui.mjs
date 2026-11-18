import { mountFaisca } from '../ui.mjs';
import { createJourney, getJourneySummary, respondJourney } from './state.mjs';

const policy = Object.freeze({ create: createJourney, summary: getJourneySummary });

/** Opt-in R07 local UI. Reuses the approved markup, artwork and CSS unchanged. */
export function mountJourney(root) {
  const mounted = mountFaisca(root, { prepareTurn: respondJourney,
    sessionPolicy: policy, replyDelayMs: 120 });
  root.dataset.faiscaMode = 'r07_local_journey';
  return mounted;
}

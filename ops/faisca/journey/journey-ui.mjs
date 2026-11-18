import { mountFaisca } from '../ui.mjs';
import { createQualificationJourney, getQualificationSummary, respondQualificationJourney } from '../qualification/journey.mjs';

const policy = Object.freeze({
  create: createQualificationJourney,
  summary: getQualificationSummary
});

/** Opt-in R08 local sales qualification, reusing the approved UI and artwork. */
export function mountJourney(root) {
  const mounted = mountFaisca(root, {
    prepareTurn: respondQualificationJourney,
    sessionPolicy: policy,
    replyDelayMs: 120
  });
  root.dataset.faiscaMode = 'r08_local_qualification';
  return mounted;
}
